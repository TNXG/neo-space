use rocket::serde::json::Json;
use rocket::{get, State};
use mongodb::{Database, Collection};
use bson::oid::ObjectId;
use crate::models::{ApiResponse, User, Reader};
use crate::services::ReaderRepository;

/// 获取用户资料（非敏感数据）
#[get("/user/profile")]
pub async fn get_user_profile(database: &State<Database>) -> Json<ApiResponse<User>> {
    let collection: Collection<mongodb::bson::Document> = database.collection("users");

    // 只投影非敏感字段
    let projection = mongodb::bson::doc! {
        "_id": 1,
        "username": 1,
        "name": 1,
        "introduce": 1,
        "avatar": 1,
        "mail": 1,
        "url": 1,
        "created": 1,
        "lastLoginTime": 1,
        "socialIds": 1
    };

    let options = mongodb::options::FindOneOptions::builder()
        .projection(projection)
        .build();

    match collection.find_one(mongodb::bson::doc! {}).with_options(options).await {
        Ok(Some(doc)) => {
            match mongodb::bson::from_document::<User>(doc) {
                Ok(user) => Json(ApiResponse::success(user)),
                Err(e) => ApiResponse::json_error_with_default(500, format!("解析用户数据失败: {}", e)),
            }
        }
        Ok(None) => ApiResponse::json_error_with_default(404, "未找到用户".to_string()),
        Err(e) => ApiResponse::json_error_with_default(500, format!("获取用户资料失败: {}", e)),
    }
}

/// 获取所有 readers（非敏感数据）
#[get("/readers")]
pub async fn list_readers(database: &State<Database>) -> Json<ApiResponse<Vec<Reader>>> {
    let repo = ReaderRepository::new(database);
    
    match repo.get_all().await {
        Ok(readers) => Json(ApiResponse::success(readers)),
        Err(e) => ApiResponse::json_error_with_default(500, format!("获取 readers 失败: {}", e)),
    }
}

/// 通过 ID 获取 reader（非敏感数据）
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
        Err(e) => ApiResponse::json_error_with_default(500, format!("获取 reader 失败: {}", e)),
    }
}