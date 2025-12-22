//! 绑定匿名身份相关路由

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::State;
use mongodb::Database;

use crate::config::OAuthConfig;
use crate::guards::AuthGuard;
use crate::models::{ApiResponse, Reader, ReaderResponse};
use crate::services::{ReaderRepository, AccountRepository};
use crate::services::auth::identity::IdentityService;

/// 绑定匿名身份请求
#[derive(Debug, Deserialize, Serialize)]
pub struct BindAnonymousRequest {
    pub name: String,
    pub email: String,
}

#[post("/bind-anonymous", data = "<request>")]
pub async fn bind_anonymous_identity(
    auth: AuthGuard,
    request: Json<crate::routes::auth::bind::BindAnonymousRequest>,
    db: &State<Database>,
    config: &State<OAuthConfig>,
) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    let id_service = IdentityService::new(db, config.jwt_secret.clone());
    let reader_repo = ReaderRepository::new(db);

    let anon_reader = reader_repo.find_by_name_and_email(&request.name, &request.email).await
        .map_err(|_| ApiResponse::internal_error("数据库查询失败".to_string()))?
        .ok_or_else(|| ApiResponse::not_found("未匹配到匿名身份".to_string()))?;

    // 迁移所有 Account
    id_service.merge_identities(auth.user_id, anon_reader.id).await
        .map_err(|e| ApiResponse::bad_request(e))?;

    // 删除临时的 Reader（如果有）
    let _ = reader_repo.delete_reader(auth.user_id).await;

    let token = id_service.issue_token(anon_reader.id, anon_reader.is_owner)
        .map_err(|e| ApiResponse::internal_error(e))?;

    Ok(ApiResponse::json_success_with_message(anon_reader.into(), token))
}

#[post("/skip-bind")]
pub async fn skip_bind(auth: AuthGuard, db: &State<Database>, config: &State<OAuthConfig>) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);
    let id_service = IdentityService::new(db, config.jwt_secret.clone());

    // 如果已经有 Reader 了，直接返回
    if let Ok(Some(r)) = reader_repo.find_by_id(auth.user_id).await {
        return Ok(ApiResponse::json_success(r.into()));
    }

    // 从 Account 创建 Reader
    let accounts = account_repo.find_by_user_id(auth.user_id).await.map_err(|_| ApiResponse::internal_error("查询失败".to_string()))?;
    let acc = accounts.first().ok_or_else(|| ApiResponse::not_found("未找到账号信息".to_string()))?;

    let is_first = reader_repo.is_empty().await.unwrap_or(false);
    let new_reader = Reader {
        id: bson::oid::ObjectId::new(),
        email: acc.oauth_email.clone().unwrap_or_default(),
        name: acc.oauth_name.clone().unwrap_or_else(|| "用户".to_string()),
        handle: acc.oauth_handle.clone().unwrap_or_else(|| Reader::generate_handle("user")),
        image: acc.oauth_avatar.clone().unwrap_or_default(),
        is_owner: is_first,
        email_verified: Some(true),
        created_at: bson::DateTime::now(),
        updated_at: bson::DateTime::now(),
    };

    let new_id = reader_repo.create_reader(&new_reader).await.map_err(|_| ApiResponse::internal_error("创建失败".to_string()))?;
    id_service.merge_identities(auth.user_id, new_id).await.map_err(|e| ApiResponse::internal_error(e))?;

    let token = id_service.issue_token(new_id, is_first).map_err(|e| ApiResponse::internal_error(e))?;
    Ok(ApiResponse::json_success_with_message(new_reader.into(), token))
}

#[get("/bindable-identities")]
pub async fn get_bindable_identities(auth: AuthGuard, db: &State<Database>) -> Result<Json<ApiResponse<Vec<ReaderResponse>>>, Json<ApiResponse<()>>> {
    let account_repo = AccountRepository::new(db);
    let reader_repo = ReaderRepository::new(db);

    let accounts = account_repo.find_by_user_id(auth.user_id).await.unwrap_or_default();
    let emails: Vec<String> = accounts.iter().filter_map(|a| a.oauth_email.clone()).collect();

    let all_readers = reader_repo.get_all().await.map_err(|_| ApiResponse::internal_error("数据库失败".to_string()))?;
    let bindable = all_readers.into_iter()
        .filter(|r| r.id != auth.user_id && emails.contains(&r.email))
        .map(Into::into).collect();

    Ok(ApiResponse::json_success(bindable))
}