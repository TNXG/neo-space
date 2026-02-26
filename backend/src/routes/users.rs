use crate::models::{ApiResponse, Reader, User};
use crate::repositories::ReaderRepository;
use bson::oid::ObjectId;
use futures::stream::TryStreamExt;
use mongodb::{Collection, Database, bson};
use rocket::serde::json::Json;
use rocket::{State, get};

/// 获取博主资料（非敏感数据）
/// 从 `owner_profiles` 和 readers 关联查询获取完整信息
#[utoipa::path(
    get,
    path = "/api/user/profile",
    responses(
        (status = 200, description = "成功获取用户资料", body = ApiResponse<User>),
        (status = 404, description = "未找到用户"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "用户管理"
)]
#[get("/user/profile")]
pub async fn get_user_profile(database: &State<Database>) -> Json<ApiResponse<User>> {
    // 使用 $lookup 聚合管道，将 owner_profiles 与 readers 一次查询完成，避免两次 DB 往返
    let owner_collection: Collection<bson::Document> = database.collection("owner_profiles");

    let pipeline = vec![
        bson::doc! {
            "$lookup": {
                "from": "readers",
                "localField": "readerId",
                "foreignField": "_id",
                "as": "reader"
            }
        },
        bson::doc! { "$unwind": "$reader" },
        bson::doc! {
            "$project": {
                "_id": 1,
                "introduce": 1,
                "mail": 1,
                "url": 1,
                "created": 1,
                "lastLoginTime": 1,
                "socialIds": 1,
                "reader.handle": 1,
                "reader.name": 1,
                "reader.image": 1,
            }
        },
        bson::doc! { "$limit": 1 },
    ];

    let mut cursor = match owner_collection.aggregate(pipeline).await {
        Ok(c) => c,
        Err(e) => {
            return ApiResponse::json_error_with_default(500, format!("聚合查询失败: {e}"));
        }
    };

    let doc = match cursor.try_next().await {
        Ok(Some(d)) => d,
        Ok(None) => {
            return ApiResponse::json_error_with_default(404, "未找到博主资料".to_string());
        }
        Err(e) => {
            return ApiResponse::json_error_with_default(500, format!("获取博主资料失败: {e}"));
        }
    };

    let owner_id = match doc.get_object_id("_id") {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::json_error_with_default(500, "博主资料缺少 _id".to_string());
        }
    };

    let reader_doc = match doc.get_document("reader") {
        Ok(r) => r,
        Err(_) => {
            return ApiResponse::json_error_with_default(500, "未找到关联的读者信息".to_string());
        }
    };

    let user = User {
        id: owner_id,
        username: reader_doc.get_str("handle").unwrap_or_default().to_string(),
        name: reader_doc.get_str("name").unwrap_or_default().to_string(),
        introduce: doc.get_str("introduce").unwrap_or_default().to_string(),
        avatar: reader_doc.get_str("image").unwrap_or_default().to_string(),
        mail: doc.get_str("mail").unwrap_or_default().to_string(),
        url: doc.get_str("url").unwrap_or_default().to_string(),
        created: doc
            .get_datetime("created")
            .cloned()
            .unwrap_or_else(|_| bson::DateTime::now()),
        last_login_time: doc
            .get_datetime("lastLoginTime")
            .cloned()
            .unwrap_or_else(|_| bson::DateTime::now()),
        social_ids: doc
            .get_document("socialIds")
            .ok()
            .and_then(|d| bson::from_document::<crate::models::UserSocialIds>(d.clone()).ok()),
    };

    Json(ApiResponse::success(user))
}

/// 获取所有 readers（非敏感数据）
#[utoipa::path(
    get,
    path = "/api/readers",
    responses(
        (status = 200, description = "成功获取读者列表", body = ApiResponse<Vec<Reader>>),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "用户管理"
)]
#[get("/readers")]
pub async fn list_readers(database: &State<Database>) -> Json<ApiResponse<Vec<Reader>>> {
    let repo = ReaderRepository::new(database);

    match repo.get_all().await {
        Ok(readers) => Json(ApiResponse::success(readers)),
        Err(e) => ApiResponse::json_error_with_default(500, format!("获取 readers 失败: {e}")),
    }
}

/// 通过 ID 获取 reader（非敏感数据）
#[utoipa::path(
    get,
    path = "/api/readers/{id}",
    params(
        ("id" = String, Path, description = "读者ID")
    ),
    responses(
        (status = 200, description = "成功获取读者详情", body = ApiResponse<Reader>),
        (status = 400, description = "无效的ID格式"),
        (status = 404, description = "未找到读者"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "用户管理"
)]
#[get("/readers/<id>")]
pub async fn get_reader_by_id(id: String, database: &State<Database>) -> Json<ApiResponse<Reader>> {
    let repo = ReaderRepository::new(database);

    let object_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => {
            return ApiResponse::json_error_with_default(400, "无效的 ID 格式".to_string());
        }
    };

    match repo.find_by_id(object_id).await {
        Ok(Some(reader)) => Json(ApiResponse::success(reader)),
        Ok(None) => ApiResponse::json_error_with_default(404, "未找到 Reader".to_string()),
        Err(e) => ApiResponse::json_error_with_default(500, format!("获取 reader 失败: {e}")),
    }
}
