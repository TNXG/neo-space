//! 管理后台仪表盘与数据页的真实内容概览。

use std::collections::BTreeMap;

use axum::{Json, extract::State};
use bson::{DateTime, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppResult},
    models::ApiResponse,
};

#[derive(Debug, Deserialize)]
struct ContentProjection {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    content: Option<String>,
    #[serde(
        default = "current_time",
        deserialize_with = "crate::models::serializers::deserialize_flexible_datetime"
    )]
    created: DateTime,
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub posts: i64,
    pub notes: i64,
    pub pages: i64,
    pub recently: i64,
    pub comments: i64,
    pub links: i64,
    pub readers: i64,
    #[serde(rename = "totalContent")]
    pub total_content: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DashboardContent {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub title: String,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub created: DateTime,
}

#[derive(Debug, Serialize)]
pub struct PublicationPoint {
    pub date: String,
    pub posts: i64,
    pub notes: i64,
    pub pages: i64,
    pub recently: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardOverview {
    pub stats: DashboardStats,
    #[serde(rename = "recentContent")]
    pub recent_content: Vec<DashboardContent>,
    #[serde(rename = "publicationTrend")]
    pub publication_trend: Vec<PublicationPoint>,
}

fn current_time() -> DateTime {
    DateTime::now()
}

async fn load_content(
    state: &SharedState,
    collection_name: &str,
    content_type: &str,
) -> AppResult<Vec<DashboardContent>> {
    let mut cursor = state
        .db
        .collection::<ContentProjection>(collection_name)
        .find(doc! {})
        .projection(doc! { "_id": 1, "title": 1, "content": 1, "created": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut contents = Vec::new();
    while let Some(content) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        contents.push(DashboardContent {
            id: content.id.to_hex(),
            content_type: content_type.to_string(),
            title: content
                .title
                .or(content.content)
                .unwrap_or_else(|| "无标题内容".to_string())
                .chars()
                .take(80)
                .collect(),
            created: content.created,
        });
    }
    Ok(contents)
}

pub async fn dashboard_overview(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<DashboardOverview>>> {
    let posts_collection = state.db.collection::<bson::Document>("posts");
    let notes_collection = state.db.collection::<bson::Document>("notes");
    let pages_collection = state.db.collection::<bson::Document>("pages");
    let recently_collection = state.db.collection::<bson::Document>("recently");
    let comments_collection = state.db.collection::<bson::Document>("comments");
    let links_collection = state.db.collection::<bson::Document>("links");
    let readers_collection = state.db.collection::<bson::Document>("readers");
    let (posts, notes, pages, recently, comments, links, readers) = tokio::try_join!(
        posts_collection.count_documents(doc! {}),
        notes_collection.count_documents(doc! {}),
        pages_collection.count_documents(doc! {}),
        recently_collection.count_documents(doc! {}),
        comments_collection.count_documents(doc! {}),
        links_collection.count_documents(doc! {}),
        readers_collection.count_documents(doc! {}),
    )
    .map_err(|error| AppError::Database(error.to_string()))?;

    let mut contents = Vec::new();
    contents.extend(load_content(&state, "posts", "post").await?);
    contents.extend(load_content(&state, "notes", "note").await?);
    contents.extend(load_content(&state, "pages", "page").await?);
    contents.extend(load_content(&state, "recently", "recently").await?);
    contents.sort_by_key(|content| std::cmp::Reverse(content.created));
    let recent_content = contents.iter().take(8).cloned().collect();

    let today = Utc::now().date_naive();
    let mut trend: BTreeMap<String, PublicationPoint> = (0..30)
        .rev()
        .map(|offset| {
            let date = (today - Duration::days(offset))
                .format("%Y-%m-%d")
                .to_string();
            (
                date.clone(),
                PublicationPoint {
                    date,
                    posts: 0,
                    notes: 0,
                    pages: 0,
                    recently: 0,
                },
            )
        })
        .collect();
    for content in &contents {
        let date = content
            .created
            .to_chrono()
            .date_naive()
            .format("%Y-%m-%d")
            .to_string();
        if let Some(point) = trend.get_mut(&date) {
            match content.content_type.as_str() {
                "post" => point.posts += 1,
                "note" => point.notes += 1,
                "page" => point.pages += 1,
                "recently" => point.recently += 1,
                _ => {}
            }
        }
    }

    Ok(Json(ApiResponse::success(DashboardOverview {
        stats: DashboardStats {
            posts: posts as i64,
            notes: notes as i64,
            pages: pages as i64,
            recently: recently as i64,
            comments: comments as i64,
            links: links as i64,
            readers: readers as i64,
            total_content: posts as i64 + notes as i64 + pages as i64 + recently as i64,
        },
        recent_content,
        publication_trend: trend.into_values().collect(),
    })))
}
