//! Options service - Site configuration queries
//!
//! IMPORTANT: This service handles the `options` collection from MongoDB.
//! Only specific, safe fields are extracted and exposed via API endpoints.
//! Sensitive data (API keys, passwords, secrets) are NEVER exposed.

use futures::stream::TryStreamExt;
use mongodb::{bson::doc, Collection, Database};
use crate::models::{
    RawOption, SiteConfig, SeoOptions, UrlOptions, FeatureListOptions,
    FriendLinkOptions, CommentOptionsPublic, OAuthPublicOptions, OAuthProvider,
    AlgoliaPublicOptions, AdminExtraPublic,
};

/// Get a single option by name (internal use only)
#[allow(unused)]
pub async fn get_option_by_name(
    database: &Database,
    name: &str,
) -> Result<Option<bson::Bson>, mongodb::error::Error> {
    let collection: Collection<RawOption> = database.collection("options");

    match collection.find_one(doc! { "name": name }).await? {
        Some(opt) => Ok(Some(opt.value)),
        None => Ok(None),
    }
}

/// Get aggregated site config (safe for frontend)
pub async fn get_site_config(database: &Database) -> Result<SiteConfig, mongodb::error::Error> {
    let collection: Collection<RawOption> = database.collection("options");

    let mut config = SiteConfig::default();

    // Fetch all options we need
    let names = vec![
        "seo", "url", "featureList", "friendLinkOptions",
        "commentOptions", "oauth", "algoliaSearchOptions", "adminExtra"
    ];

    let mut cursor = collection
        .find(doc! { "name": { "$in": &names } })
        .await?;

    while let Some(opt) = cursor.try_next().await? {
        match opt.name.as_str() {
            "seo" => {
                if let Ok(seo) = bson::from_bson::<SeoOptions>(opt.value) {
                    config.seo = seo;
                }
            }
            "url" => {
                if let Ok(url) = bson::from_bson::<UrlOptions>(opt.value) {
                    config.url = url;
                }
            }
            "featureList" => {
                if let Ok(features) = bson::from_bson::<FeatureListOptions>(opt.value) {
                    config.features = features;
                }
            }
            "friendLinkOptions" => {
                if let Ok(friend) = bson::from_bson::<FriendLinkOptions>(opt.value) {
                    config.friend_link = friend;
                }
            }
            "commentOptions" => {
                // Only extract safe fields
                if let bson::Bson::Document(doc) = opt.value {
                    config.comment = CommentOptionsPublic {
                        disable_comment: doc.get_bool("disableComment").unwrap_or(false),
                        disable_no_chinese: doc.get_bool("disableNoChinese").unwrap_or(false),
                    };
                }
            }
            "oauth" => {
                // Only extract public fields
                if let bson::Bson::Document(doc) = opt.value {
                    let mut oauth = OAuthPublicOptions::default();

                    // Get providers
                    if let Ok(providers) = doc.get_array("providers") {
                        oauth.providers = providers
                            .iter()
                            .filter_map(|p| bson::from_bson::<OAuthProvider>(p.clone()).ok())
                            .collect();
                    }

                    // Get public github client id
                    if let Ok(public) = doc.get_document("public") {
                        if let Ok(github) = public.get_document("github") {
                            oauth.github_client_id = github.get_str("clientId").ok().map(String::from);
                        }
                    }

                    config.oauth = oauth;
                }
            }
            "algoliaSearchOptions" => {
                // Only extract public fields (no apiKey)
                if let bson::Bson::Document(doc) = opt.value {
                    config.algolia = AlgoliaPublicOptions {
                        enable: doc.get_bool("enable").unwrap_or(false),
                        app_id: doc.get_str("appId").ok().map(String::from),
                        index_name: doc.get_str("indexName").ok().map(String::from),
                    };
                }
            }
            "adminExtra" => {
                // Only extract safe fields
                if let bson::Bson::Document(doc) = opt.value {
                    config.admin_extra = AdminExtraPublic {
                        title: doc.get_str("title").ok().map(String::from),
                        background: doc.get_str("background").ok().map(String::from),
                    };
                }
            }
            _ => {}
        }
    }

    Ok(config)
}
