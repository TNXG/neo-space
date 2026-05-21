//! Options service - Site configuration queries
//!
//! Aggregates multiple option documents from MongoDB into a single SiteConfig.
//! Only safe fields are extracted and exposed - sensitive data is NEVER exposed.
//! Matches Rocket's options_service.rs behavior for data consistency.

use crate::models::options::*;
use futures::stream::TryStreamExt;
use mongodb::{Collection, Database, bson::doc};

/// Get aggregated site config (safe for frontend)
pub async fn get_site_config(database: &Database) -> Result<SiteConfig, mongodb::error::Error> {
    let collection: Collection<RawOption> = database.collection("options");

    let mut config = SiteConfig::default();

    // Fetch all options we need
    let names = vec![
        "seo",
        "url",
        "featureList",
        "friendLinkOptions",
        "commentOptions",
        "oauth",
        "algoliaSearchOptions",
        "adminExtra",
    ];

    let mut cursor = collection.find(doc! { "name": { "$in": &names } }).await?;

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
                    if let Ok(public) = doc.get_document("public")
                        && let Ok(github) = public.get_document("github")
                    {
                        oauth.github_client_id = github.get_str("clientId").ok().map(String::from);
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
