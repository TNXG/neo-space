//! 头像更新相关路由

use rocket::serde::json::Json;
use rocket::serde::Deserialize;
use rocket::State;
use mongodb::Database;

use crate::guards::AuthGuard;
use crate::models::{ApiResponse, ReaderResponse};
use crate::services::{ReaderRepository, AccountRepository};

/// 更新头像请求
#[derive(Debug, Deserialize)]
pub struct UpdateAvatarRequest {
    pub provider: String, // "github" | "qq" | "gravatar"
}
use crate::services::auth::avatar::AvatarService;

#[put("/avatar", data = "<request>")]
pub async fn update_avatar(auth: AuthGuard, request: Json<UpdateAvatarRequest>, db: &State<Database>) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    let reader_repo = ReaderRepository::new(db);
    let mut reader = reader_repo.find_by_id(auth.user_id).await
        .map_err(|_| ApiResponse::internal_error("数据库查询失败".to_string()))?
        .ok_or_else(|| ApiResponse::not_found("用户不存在".to_string()))?;

    let new_avatar = match request.provider.as_str() {
        "gravatar" => AvatarService::get_gravatar_url(&reader.email),
        "github" | "qq" => {
            let account_repo = AccountRepository::new(db);
            let accounts = account_repo.find_by_user_id(auth.user_id).await.unwrap_or_default();
            AvatarService::get_oauth_avatar(&request.provider, &accounts)
                .ok_or_else(|| ApiResponse::not_found("未关联该账号".to_string()))?
        }
        _ => return Err(ApiResponse::bad_request("不支持的提供商".to_string())),
    };

    reader.image = new_avatar;
    reader_repo.update_reader(&reader).await.map_err(|_| ApiResponse::internal_error("更新失败".to_string()))?;

    Ok(ApiResponse::json_success(reader.into()))
}