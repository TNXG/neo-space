//! Admin categories / tags CRUD（owner-only）
//!
//! 公共读取（list categories）位于 handlers/misc/site.rs。

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub slug: String,
    #[serde(rename = "type", default)]
    pub category_type: Option<i32>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub slug: Option<String>,
    #[serde(rename = "type")]
    pub category_type: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CategoryQuery {
    #[serde(default)]
    pub tag: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TagItem {
    pub name: String,
    pub count: i64,
}

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

/// POST /categories
pub async fn create_category(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateCategoryRequest>,
) -> AppResult<Json<ApiResponse<Category>>> {
    let collection = state.db.collection::<Category>("categories");
    if collection
        .find_one(doc! { "slug": &req.slug })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .is_some()
    {
        return Err(AppError::BadRequest(format!(
            "Slug '{}' 已被使用",
            req.slug
        )));
    }
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "name": &req.name,
        "slug": &req.slug,
        "type": req.category_type.unwrap_or(0),
        "created": bson::DateTime::now(),
    };
    state
        .db
        .collection::<bson::Document>("categories")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let cat = collection
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Category not found after insert".into()))?;
    Ok(Json(ApiResponse::success(cat)))
}

/// PUT /categories/{id}
pub async fn update_category(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdateCategoryRequest>,
) -> AppResult<Json<ApiResponse<Category>>> {
    let oid = parse_oid(&id)?;
    let mut set_doc = doc! {};
    if let Some(v) = req.name {
        set_doc.insert("name", v);
    }
    if let Some(v) = req.slug {
        set_doc.insert("slug", v);
    }
    if let Some(v) = req.category_type {
        set_doc.insert("type", v);
    }
    let collection = state.db.collection::<Category>("categories");
    let result = collection
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.matched_count == 0 {
        return Err(AppError::NotFound("Category not found".into()));
    }
    let updated = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Category not found".into()))?;
    Ok(Json(ApiResponse::success(updated)))
}

/// DELETE /categories/{id}
pub async fn delete_category(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let used = state
        .db
        .collection::<Post>("posts")
        .count_documents(doc! { "categoryId": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if used > 0 {
        return Err(AppError::BadRequest(format!(
            "该分类下尚有 {} 篇文章，无法删除",
            used
        )));
    }
    let result = state
        .db
        .collection::<Category>("categories")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Category not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

/// GET /categories?type=tag — 返回标签聚合列表
pub async fn list_tags(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<Vec<TagItem>>>> {
    let pipeline = vec![
        doc! { "$match": { "isPublished": true } },
        doc! { "$unwind": "$tags" },
        doc! { "$group": { "_id": "$tags", "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1 } },
    ];
    let mut cursor = state
        .db
        .collection::<bson::Document>("posts")
        .aggregate(pipeline)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        let name = d.get_str("_id").unwrap_or("").to_string();
        let count = d.get_i32("count").map(|v| v as i64).unwrap_or(0);
        if !name.is_empty() {
            items.push(TagItem { name, count });
        }
    }
    Ok(Json(ApiResponse::success(items)))
}

/// GET /categories/{name}?tag=true — 返回指定 tag 下的文章
pub async fn get_posts_by_tag(
    State(state): State<SharedState>,
    Path(name): Path<String>,
    AppQuery(q): AppQuery<CategoryQuery>,
) -> AppResult<Json<ApiResponse<Vec<Post>>>> {
    if q.tag.as_deref() != Some("true") {
        return Err(AppError::BadRequest("缺少 tag=true 参数".into()));
    }
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    let mut cursor = state
        .db
        .collection::<Post>("posts")
        .find(doc! { "tags": &name, "isPublished": true })
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(p) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(p);
    }
    Ok(Json(ApiResponse::success(items)))
}
