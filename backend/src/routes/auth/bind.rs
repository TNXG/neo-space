//! 绑定匿名身份相关路由

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::State;
use mongodb::Database;

use crate::config::OAuthConfig;
use crate::guards::AuthGuard;
use crate::models::{ApiResponse, ResponseStatus, Reader, ReaderResponse};
use crate::services::{ReaderRepository, AccountRepository};
use crate::utils::jwt::generate_jwt;
use bson::oid::ObjectId;

/// 绑定匿名身份请求
#[derive(Debug, Deserialize, Serialize)]
pub struct BindAnonymousRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
}

#[post("/bind-anonymous", data = "<request>")]
pub async fn bind_anonymous_identity(
    auth: AuthGuard,
    request: Json<BindAnonymousRequest>,
    db: &State<Database>,
    config: &State<OAuthConfig>,
) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    log::info!("绑定匿名身份请求: user_id={}", auth.user_id);

    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);

    // 1. 获取要绑定的匿名 Reader 的 name 和 email
    let (target_name, target_email) = if let (Some(name), Some(email)) = (&request.name, &request.email) {
        // 如果请求中提供了 name 和 email，使用它们
        (name.clone(), email.clone())
    } else {
        // 否则从当前用户的 Reader 获取
        let current_reader = reader_repo
            .find_by_id(auth.user_id)
            .await
            .map_err(|e| {
                log::error!("查询当前 Reader 失败: {}", e);
                Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "数据库查询失败".to_string(),
                    data: (),
                })
            })?
            .ok_or_else(|| {
                log::warn!("当前用户 Reader 不存在: user_id={}", auth.user_id);
                Json(ApiResponse {
                    code: 404,
                    status: ResponseStatus::Failed,
                    message: "当前用户不存在".to_string(),
                    data: (),
                })
            })?;

        (current_reader.name.clone(), current_reader.email.clone())
    };

    // 2. 查找匿名 Reader（根据 name + email）
    let anonymous_reader = reader_repo
        .find_by_name_and_email(&target_name, &target_email)
        .await
        .map_err(|e| {
            log::error!("查询匿名 Reader 失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?
        .ok_or_else(|| {
            log::warn!("未找到匹配的匿名 Reader: name={}, email={}", &target_name, &target_email);
            Json(ApiResponse {
                code: 404,
                status: ResponseStatus::Failed,
                message: "未找到匿配的匿名身份，请确认昵称和邮箱完全一致".to_string(),
                data: (),
            })
        })?;

    // 3. 不再检查匿名 Reader 是否已绑定 OAuth 账号
    // 允许一个 Reader 绑定多个 OAuth 账号（GitHub + QQ 等）

    // 4. 获取当前 OAuth 用户的所有 Account
    let current_accounts = account_repo
        .find_by_user_id(auth.user_id)
        .await
        .map_err(|e| {
            log::error!("查询当前用户 Account 失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?;

    // 5. 将所有 Account 的 userId 改为匿名 Reader 的 ID
    let accounts_count = current_accounts.len();
    for account in &current_accounts {
        account_repo
            .update_user_id(account.id, anonymous_reader.id)
            .await
            .map_err(|e| {
                log::error!("更新 Account userId 失败: {}", e);
                Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "更新账号关联失败".to_string(),
                    data: (),
                })
            })?;
    }

    // 6. 检查当前 OAuth 用户是否有对应的 Reader（新流程中可能没有）
    if let Some(_) = reader_repo.find_by_id(auth.user_id).await.map_err(|e| {
        log::error!("查询 OAuth Reader 失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "数据库查询失败".to_string(),
            data: (),
        })
    })? {
        // 删除 OAuth 创建的临时 Reader
        reader_repo.delete_reader(auth.user_id).await.map_err(|e| {
            log::error!("删除 OAuth Reader 失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "删除临时用户失败".to_string(),
                data: (),
            })
        })?;
    }

    log::info!(
        "成功绑定匿名身份: oauth_user_id={}, anonymous_reader={}, accounts_count={}",
        auth.user_id,
        anonymous_reader.id,
        accounts_count
    );

    // 7. 生成新的 JWT token（使用真正的 Reader ID）
    let new_jwt_token = generate_jwt(anonymous_reader.id, anonymous_reader.is_owner, &config.jwt_secret).map_err(|e| {
        log::error!("生成 JWT 失败: {:?}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "生成令牌失败".to_string(),
            data: (),
        })
    })?;

    // 返回 Reader 信息，新 token 在 message 中
    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: new_jwt_token, // 将新 token 放在 message 中返回
        data: anonymous_reader.into(),
    }))
}

/// 跳过绑定 - 为新 OAuth 用户创建 Reader
/// 
/// # 路由
/// POST /api/auth/skip-bind
/// 
/// # 认证
/// 需要 JWT token（AuthGuard）
/// 
/// # 说明
/// 当新用户选择跳过绑定匿名身份时调用此接口
/// 会根据 Account 中保存的 OAuth 用户信息创建新的 Reader
#[post("/skip-bind")]
pub async fn skip_bind(
    auth: AuthGuard,
    db: &State<Database>,
    config: &State<OAuthConfig>,
) -> Result<Json<ApiResponse<ReaderResponse>>, Json<ApiResponse<()>>> {
    log::info!("跳过绑定请求: user_id={}", auth.user_id);

    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);

    // 1. 检查是否已经有 Reader（防止重复调用）
    if let Some(existing_reader) = reader_repo.find_by_id(auth.user_id).await.map_err(|e| {
        log::error!("查询 Reader 失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "数据库查询失败".to_string(),
            data: (),
        })
    })? {
        log::info!("用户已有 Reader，无需创建: reader_id={}", existing_reader.id);
        return Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "用户已存在".to_string(),
            data: existing_reader.into(),
        }));
    }

    // 2. 获取当前用户的 Account（包含 OAuth 用户信息）
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
        log::error!("未找到 Account: user_id={}", auth.user_id);
        Json(ApiResponse {
            code: 404,
            status: ResponseStatus::Failed,
            message: "未找到账号信息".to_string(),
            data: (),
        })
    })?;

    // 3. 从 Account 中获取 OAuth 用户信息
    let name = account.oauth_name.clone().ok_or_else(|| {
        log::error!("Account 缺少 oauth_name: account_id={}", account.id);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "账号信息不完整".to_string(),
            data: (),
        })
    })?;

    let email = account.oauth_email.clone().unwrap_or_default();
    let avatar = account.oauth_avatar.clone().unwrap_or_default();
    let handle = account.oauth_handle.clone().unwrap_or_else(|| Reader::generate_handle(&name));

    // 4. 检查是否是第一个用户（自动设为 Owner）
    let is_first_user = reader_repo.is_empty().await.map_err(|e| {
        log::error!("检查 readers 集合失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "数据库查询失败".to_string(),
            data: (),
        })
    })?;

    // 5. 创建新的 Reader
    let email_verified = if email.is_empty() || email.ends_with("@qq.oauth") {
        Some(false)
    } else {
        Some(true)
    };

    let new_reader = Reader {
        id: ObjectId::new(),
        email,
        name,
        handle,
        image: avatar,
        is_owner: is_first_user,
        email_verified,
        created_at: bson::DateTime::now(),
        updated_at: bson::DateTime::now(),
    };

    let reader_id = reader_repo.create_reader(&new_reader).await.map_err(|e| {
        log::error!("创建 Reader 失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "创建用户失败".to_string(),
            data: (),
        })
    })?;

    // 6. 更新所有 Account 的 userId 为新创建的 Reader ID
    for acc in &accounts {
        account_repo
            .update_user_id(acc.id, reader_id)
            .await
            .map_err(|e| {
                log::error!("更新 Account userId 失败: {}", e);
                Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "更新账号关联失败".to_string(),
                    data: (),
                })
            })?;
    }

    log::info!(
        "跳过绑定成功，创建新 Reader: reader_id={}, is_owner={}",
        reader_id,
        is_first_user
    );

    // 7. 生成新的 JWT token（使用真正的 Reader ID）
    let new_jwt_token = generate_jwt(reader_id, is_first_user, &config.jwt_secret).map_err(|e| {
        log::error!("生成 JWT 失败: {:?}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "生成令牌失败".to_string(),
            data: (),
        })
    })?;

    // 返回新 Reader 信息和新 token
    let mut reader_response: ReaderResponse = new_reader.into();
    reader_response.id = reader_id;

    // 注意：这里返回的 data 中包含新的 token，前端需要更新
    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: new_jwt_token, // 将新 token 放在 message 中返回
        data: reader_response,
    }))
}

/// 更新头像请求
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateAvatarRequest {
    pub provider: String, // "github" | "qq" | "gravatar"
}

/// 更新用户头像
/// 
/// # 路由
/// PUT /api/auth/avatar
/// 
/// # 认证
/// 需要 JWT token（AuthGuard）
/// 
/// # 请求体
/// ```json
/// {
///   "provider": "github" | "qq" | "gravatar"
/// }
/// ```
/// 
/// # 说明
/// 根据 provider 从对应的 Account 中获取头像 URL，并更新 Reader 的 image 字段
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

/// 获取可绑定的匿名身份列表
/// 
/// # 路由
/// GET /api/auth/bindable-identities
/// 
/// # 认证
/// 需要 JWT token（AuthGuard）
/// 
/// # 说明
/// 返回所有可能属于当前用户的匿名 Reader（通过邮箱匹配）
#[get("/bindable-identities")]
pub async fn get_bindable_identities(
    auth: AuthGuard,
    db: &State<Database>,
) -> Result<Json<ApiResponse<Vec<ReaderResponse>>>, Json<ApiResponse<()>>> {
    log::debug!("获取可绑定身份列表: user_id={}", auth.user_id);

    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);

    // 1. 获取当前用户的所有 Account
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

    // 2. 收集所有邮箱（排除 QQ 临时邮箱）
    let mut emails: Vec<String> = accounts
        .iter()
        .filter_map(|acc| {
            acc.oauth_email.as_ref().and_then(|email| {
                if !email.ends_with("@qq.oauth") && !email.is_empty() {
                    Some(email.clone())
                } else {
                    None
                }
            })
        })
        .collect();

    // 3. 如果当前用户已经有 Reader，也加入其邮箱
    if let Ok(Some(current_reader)) = reader_repo.find_by_id(auth.user_id).await {
        if !current_reader.email.is_empty() && !current_reader.email.ends_with("@qq.oauth") {
            emails.push(current_reader.email);
        }
    }

    if emails.is_empty() {
        return Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "没有可绑定的身份".to_string(),
            data: vec![],
        }));
    }

    // 4. 查找所有匹配邮箱的 Reader（排除当前用户）
    let all_readers = reader_repo.get_all().await.map_err(|e| {
        log::error!("查询 Readers 失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "数据库查询失败".to_string(),
            data: (),
        })
    })?;

    let bindable_readers: Vec<ReaderResponse> = all_readers
        .into_iter()
        .filter(|reader| {
            // 排除当前用户自己
            reader.id != auth.user_id
                // 邮箱匹配
                && emails.contains(&reader.email)
                // 排除已经绑定 OAuth 的 Reader（通过检查是否有 Account）
                && !reader.email.ends_with("@qq.oauth")
        })
        .map(|reader| reader.into())
        .collect();

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: format!("找到 {} 个可绑定的身份", bindable_readers.len()),
        data: bindable_readers,
    }))
}
