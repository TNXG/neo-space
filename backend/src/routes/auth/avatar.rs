//! 头像更新相关路由

use rocket::serde::json::Json;
use rocket::serde::Deserialize;
use rocket::State;
use mongodb::Database;

use crate::guards::AuthGuard;
use crate::models::{ApiResponse, ResponseStatus, ReaderResponse};
use crate::services::{ReaderRepository, AccountRepository};

/// 更新头像请求
#[derive(Debug, Deserialize)]
pub struct UpdateAvatarRequest {
    pub provider: String, // "github" | "qq" | "gravatar"
}

#[put("/avatar", data = "<request>")]
pub async fn update_avatar(
    auth: AuthGuard,
    request: Json<UpdateAvatarRequest>,
    db: &State<Database>,
) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    log::info!("更新头像请求: user_id={}, provider={}", auth.user_id, request.provider);

    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);

    // 1. 获取当前 Reader
    let mut reader = reader_repo
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
        })?
        .ok_or_else(|| {
            log::error!("Reader 不存在: user_id={}", auth.user_id);
            Json(ApiResponse {
                code: 404,
                status: ResponseStatus::Failed,
                message: "用户不存在".to_string(),
                data: (),
            })
        })?;

    // 2. 根据 provider 获取头像 URL
    let new_avatar = match request.provider.as_str() {
        "gravatar" => {
            // 使用 Gravatar（基于邮箱）
            if reader.email.is_empty() {
                return Err(Json(ApiResponse {
                    code: 400,
                    status: ResponseStatus::Failed,
                    message: "邮箱为空，无法使用 Gravatar".to_string(),
                    data: (),
                }));
            }
            format!(
                "https://cravatar.cn/avatar/{:x}",
                md5::compute(reader.email.trim().to_lowercase().as_bytes())
            )
        }
        "github" | "qq" => {
            // 从 Account 中获取 OAuth 头像
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

            let account = accounts
                .iter()
                .find(|acc| acc.provider == request.provider)
                .ok_or_else(|| {
                    log::warn!("未找到 {} 账号: user_id={}", request.provider, auth.user_id);
                    Json(ApiResponse {
                        code: 404,
                        status: ResponseStatus::Failed,
                        message: format!("未关联 {} 账号", request.provider),
                        data: (),
                    })
                })?;

            account.oauth_avatar.clone().ok_or_else(|| {
                log::error!("Account 缺少 oauth_avatar: account_id={}", account.id);
                Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "账号头像信息缺失".to_string(),
                    data: (),
                })
            })?
        }
        _ => {
            return Err(Json(ApiResponse {
                code: 400,
                status: ResponseStatus::Failed,
                message: format!("不支持的 provider: {}", request.provider),
                data: (),
            }));
        }
    };

    // 3. 更新 Reader 的 image 字段
    reader.image = new_avatar.clone();
    reader.updated_at = bson::DateTime::now();

    reader_repo.update_reader(&reader).await.map_err(|e| {
        log::error!("更新 Reader 失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "更新头像失败".to_string(),
            data: (),
        })
    })?;

    log::info!("头像更新成功: user_id={}, provider={}, new_avatar={}", auth.user_id, request.provider, new_avatar);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "头像更新成功".to_string(),
        data: reader.into(),
    }))
}