//! 认证路由 - OAuth 登录、用户信息、账号管理

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::State;
use mongodb::Database;

use crate::guards::AuthGuard;
use crate::models::{ApiResponse, ResponseStatus, ReaderResponse, AccountResponse};
use crate::services::{ReaderRepository, AccountRepository};

#[get("/me")]
pub async fn get_current_user(
    auth: AuthGuard,
    db: &State<Database>,
) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    log::debug!("获取当前用户信息: user_id={}", auth.user_id);

    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);

    // 1. 尝试查找 Reader
    let reader_opt = reader_repo
        .find_by_id(auth.user_id)
        .await
        .map_err(|e| {
            log::error!("查询 Reader 失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?;

    if let Some(reader) = reader_opt {
        // 老用户：直接返回 Reader 信息
        Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "获取用户信息成功".to_string(),
            data: reader.into(),
        }))
    } else {
        // 新用户：Reader 不存在，尝试从 Account 中获取 OAuth 信息
        log::debug!("Reader 不存在，尝试从 Account 获取信息: user_id={}", auth.user_id);
        
        let accounts = account_repo
            .find_by_user_id(auth.user_id)
            .await
            .map_err(|e| {
                log::error!("查询 Account 失败: {}", e);
                Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "数据库查询失败".to_string(),
                    data: (),
                })
            })?;

        let account = accounts.first().ok_or_else(|| {
            log::error!("Reader 和 Account 都不存在: user_id={}", auth.user_id);
            Json(ApiResponse {
                code: 404,
                status: ResponseStatus::Failed,
                message: "用户不存在".to_string(),
                data: (),
            })
        })?;

        // 从 Account 构造临时的 ReaderResponse
        let temp_reader = ReaderResponse {
            id: auth.user_id,
            email: account.oauth_email.clone().unwrap_or_default(),
            name: account.oauth_name.clone().unwrap_or_else(|| "未知用户".to_string()),
            handle: account.oauth_handle.clone().unwrap_or_default(),
            image: account.oauth_avatar.clone().unwrap_or_default(),
            is_owner: auth.is_owner,
            email_verified: Some(false),
            created_at: account.created_at,
            updated_at: account.updated_at,
        };

        log::debug!("返回临时用户信息（来自 Account）: name={}", temp_reader.name);

        Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "获取用户信息成功（新用户）".to_string(),
            data: temp_reader,
        }))
    }
}

/// 获取关联账号列表
/// 
/// # 路由
/// GET /api/auth/accounts
/// 
/// # 认证
/// 需要 JWT token（AuthGuard）
#[get("/accounts")]
pub async fn get_accounts(
    auth: AuthGuard,
    db: &State<Database>,
) -> Result<Json<ApiResponse<Vec<AccountResponse>>>, Json<ApiResponse<()>>> {
    log::debug!("获取关联账号列表: user_id={}", auth.user_id);

    let account_repo = AccountRepository::new(db);

    let accounts = account_repo
        .find_by_user_id(auth.user_id)
        .await
        .map_err(|e| {
            log::error!("查询 Accounts 失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "获取账号列表成功".to_string(),
        data: accounts.into_iter().map(|a| a.into()).collect(),
    }))
}