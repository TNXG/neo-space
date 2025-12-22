use rocket::serde::json::Json;
use rocket::State;
use mongodb::Database;
use crate::guards::AuthGuard;
use crate::models::{ApiResponse, ReaderResponse, AccountResponse};
use crate::services::{ReaderRepository, AccountRepository};

#[get("/me")]
pub async fn get_current_user(auth: AuthGuard, db: &State<Database>) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    let reader_repo = ReaderRepository::new(db);
    
    // 1. 尝试获取真实 Reader
    if let Ok(Some(reader)) = reader_repo.find_by_id(auth.user_id).await {
        return Ok(ApiResponse::json_success(reader.into()));
    }

    // 2. 否则获取 Account 信息作为临时身份
    let account_repo = AccountRepository::new(db);
    let accounts = account_repo.find_by_user_id(auth.user_id).await
        .map_err(|_| ApiResponse::internal_error("数据库错误".to_string()))?;

    if let Some(acc) = accounts.first() {
        let mut resp: ReaderResponse = acc.into();
        resp.is_owner = auth.is_owner;
        return Ok(ApiResponse::json_success_with_message(resp, "临时身份".into()));
    }

    Err(ApiResponse::not_found("用户不存在".into()))
}

#[get("/accounts")]
pub async fn get_accounts(auth: AuthGuard, db: &State<Database>) -> Result<Json<ApiResponse<Vec<AccountResponse>>>, Json<ApiResponse<()>>> {
    let account_repo = AccountRepository::new(db);
    let accounts = account_repo.find_by_user_id(auth.user_id).await
        .map_err(|_| ApiResponse::internal_error("数据库错误".to_string()))?;

    Ok(ApiResponse::json_success(
        accounts.into_iter().map(Into::into).collect()
    ))
}