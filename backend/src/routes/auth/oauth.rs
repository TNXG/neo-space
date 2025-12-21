//! 认证路由 - OAuth 登录、用户信息、账号管理

use rocket::serde::json::Json;
use rocket::{State, response::Redirect};
use rocket::http::{Cookie, CookieJar, SameSite};
use mongodb::Database;

use crate::config::OAuthConfig;
use crate::models::{ApiResponse, ResponseStatus, Account, };
use crate::services::{
    ReaderRepository, AccountRepository, 
    GitHubOAuthService, QQOAuthService
};
use crate::utils::jwt::generate_jwt;
use bson::oid::ObjectId;


#[get("/oauth/<provider>")]
pub async fn oauth_redirect(
    provider: String,
    config: &State<OAuthConfig>,
    db: &State<Database>,
) -> Result<Redirect, Json<ApiResponse<()>>> {
    log::info!("OAuth 重定向请求: provider={}", provider);

    // 从数据库读取最新的 OAuth 配置
    let options_repo = crate::services::OptionsRepository::new(db);
    let db_oauth_options = options_repo.get_oauth_config().await.map_err(|e| {
        log::error!("从数据库读取 OAuth 配置失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "读取 OAuth 配置失败".to_string(),
            data: (),
        })
    })?;

    // 使用数据库配置，如果为空则使用环境变量配置
    let github_client_id = db_oauth_options.github_client_id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| config.github_client_id.clone());
    
    let redirect_url = match provider.as_str() {
        "github" => {
            if github_client_id.is_empty() {
                log::error!("GitHub OAuth 未配置");
                return Err(Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "GitHub OAuth 未配置".to_string(),
                    data: (),
                }));
            }
            // GitHub OAuth 授权 URL
            format!(
                "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=user:email",
                github_client_id,
                urlencoding::encode(&config.github_redirect_uri())
            )
        }
        "qq" => {
            // QQ OAuth 使用第三方接口（xc.null.red），不需要配置密钥
            let qq_service = QQOAuthService::new(
                config.qq_redirect_uri(),
            );
            qq_service.get_authorize_url()
        }
        _ => {
            log::warn!("不支持的 OAuth 提供商: {}", provider);
            return Err(Json(ApiResponse {
                code: 400,
                status: ResponseStatus::Failed,
                message: format!("不支持的 OAuth 提供商: {}", provider),
                data: (),
            }));
        }
    };

    log::debug!("重定向到: {}", redirect_url);
    Ok(Redirect::to(redirect_url))
}

/// OAuth 回调端点 - 处理 OAuth 提供商的回调
/// 
/// # 路由
/// GET /api/auth/oauth/<provider>/callback?code=xxx
/// 
/// # 参数
/// * `provider` - OAuth 提供商（"github" 或 "qq"）
/// * `code` - OAuth 授权码
#[get("/oauth/<provider>/callback?<code>")]
pub async fn oauth_callback(
    provider: String,
    code: String,
    config: &State<OAuthConfig>,
    db: &State<Database>,
    cookies: &CookieJar<'_>,
) -> Result<Redirect, Json<ApiResponse<()>>> {
    log::info!("OAuth 回调: provider={}", provider);

    // 根据提供商处理 OAuth 流程
    let result = match provider.as_str() {
        "github" => handle_github_oauth(code, config, db).await?,
        "qq" => handle_qq_oauth(code, config, db).await?,
        _ => {
            return Err(Json(ApiResponse {
                code: 400,
                status: ResponseStatus::Failed,
                message: format!("不支持的 OAuth 提供商: {}", provider),
                data: (),
            }));
        }
    };

    log::info!(
        "OAuth 登录成功: provider={}, jwt_user_id={}, is_owner={}, is_new_user={}",
        provider,
        result.jwt_user_id,
        result.is_owner,
        result.is_new_user
    );

    // 设置 HttpOnly Cookie（7天过期）- 用于后续 API 请求
    let mut cookie = Cookie::new("auth_token", result.jwt_token.clone());
    cookie.set_http_only(true);
    cookie.set_secure(true); // 生产环境必须使用 HTTPS
    cookie.set_same_site(SameSite::Lax);
    cookie.set_path("/");
    cookie.set_max_age(rocket::time::Duration::days(7));
    
    cookies.add(cookie);

    // 重定向到前端回调页面，携带 token 和 is_new_user 标记
    // 弹窗会通过 postMessage 将信息传递给父窗口，然后关闭
    let callback_url = format!(
        "{}/auth/callback?token={}&new_user={}",
        config.frontend_url,
        result.jwt_token,
        result.is_new_user
    );
    Ok(Redirect::to(callback_url))
}

/// OAuth 登录结果（新用户时不创建 Reader）
struct OAuthLoginResult {
    /// 用于 JWT 的 ID（老用户是 Reader ID，新用户是 Account ID）
    jwt_user_id: ObjectId,
    /// 是否是 Owner
    is_owner: bool,
    /// Account 记录
    account: Account,
    /// JWT token
    jwt_token: String,
    /// 是否是新用户
    is_new_user: bool,
}

/// 处理 GitHub OAuth 流程
/// 
/// 新流程：
/// - 老用户：直接返回 Reader 信息
/// - 新用户：只创建 Account，不创建 Reader（等用户选择绑定或跳过后再创建）
async fn handle_github_oauth(
    code: String,
    config: &State<OAuthConfig>,
    db: &State<Database>,
) -> Result<OAuthLoginResult, Json<ApiResponse<()>>> {
    // 从数据库读取最新的 OAuth 配置
    let options_repo = crate::services::OptionsRepository::new(db);
    let db_oauth_options = options_repo.get_oauth_config().await.map_err(|e| {
        log::error!("从数据库读取 OAuth 配置失败: {}", e);
        Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "读取 OAuth 配置失败".to_string(),
            data: (),
        })
    })?;

    // 使用数据库配置，如果为空则使用环境变量配置
    let github_client_id = db_oauth_options.github_client_id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| config.github_client_id.clone());
    
    let github_client_secret = db_oauth_options.github_client_secret
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| config.github_client_secret.clone());

    if github_client_id.is_empty() || github_client_secret.is_empty() {
        log::error!("GitHub OAuth 未配置");
        return Err(Json(ApiResponse {
            code: 500,
            status: ResponseStatus::Failed,
            message: "GitHub OAuth 未配置".to_string(),
            data: (),
        }));
    }

    // 1. 创建 GitHub OAuth 服务
    let github_service = GitHubOAuthService::new(
        github_client_id,
        github_client_secret,
    );

    // 2. 执行 OAuth 流程
    let (github_user, access_token, scope) = github_service
        .oauth_flow(&code)
        .await
        .map_err(|e| {
            log::error!("GitHub OAuth 流程失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: format!("GitHub OAuth 失败: {}", e),
                data: (),
            })
        })?;

    // 3. 检查账号是否已存在
    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);

    let existing_account = account_repo
        .find_by_provider_and_account_id("github", &github_user.id.to_string())
        .await
        .map_err(|e| {
            log::error!("查询 GitHub 账号失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?;

    if let Some(existing_account) = existing_account {
        // 老用户：账号已存在，获取对应的 Reader
        let reader = reader_repo
            .find_by_id(existing_account.user_id)
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
                log::error!("Reader 不存在: user_id={}", existing_account.user_id);
                Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "用户数据不一致".to_string(),
                    data: (),
                })
            })?;
        
        // 生成 JWT token
        let jwt_token = generate_jwt(reader.id, reader.is_owner, &config.jwt_secret).map_err(|e| {
            log::error!("生成 JWT 失败: {:?}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "生成令牌失败".to_string(),
                data: (),
            })
        })?;

        Ok(OAuthLoginResult {
            jwt_user_id: reader.id,
            is_owner: reader.is_owner,
            account: existing_account,
            jwt_token,
            is_new_user: false,
        })
    } else {
        // 新用户：只创建 Account，不创建 Reader
        // 使用 Account 的 ID 作为临时 userId（后续绑定或跳过时会更新）
        let account_id = ObjectId::new();
        
        // 检查是否是第一个用户（自动设为 Owner）
        let is_first_user = reader_repo.is_empty().await.map_err(|e| {
            log::error!("检查 readers 集合失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?;

        // 创建 Account（userId 暂时设为 account_id，后续会更新）
        // 保存 OAuth 用户信息，以便跳过绑定时创建 Reader
        let mut new_account = Account::new_github_with_info(
            account_id, // 临时 userId，后续会更新
            github_user.id,
            access_token,
            Some(scope),
            github_user.name.clone().unwrap_or_else(|| github_user.login.clone()),
            github_user.email.clone(),
            github_user.avatar_url.clone(),
            github_user.login.clone(),
        );
        new_account.id = account_id;

        account_repo.create_account(&new_account).await.map_err(|e| {
            log::error!("创建 Account 失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "创建账号关联失败".to_string(),
                data: (),
            })
        })?;

        log::info!("新用户 OAuth 登录: account_id={}, 等待用户选择绑定或跳过", account_id);

        // 生成 JWT token（使用 account_id 作为临时 user_id）
        let jwt_token = generate_jwt(account_id, is_first_user, &config.jwt_secret).map_err(|e| {
            log::error!("生成 JWT 失败: {:?}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "生成令牌失败".to_string(),
                data: (),
            })
        })?;

        Ok(OAuthLoginResult {
            jwt_user_id: account_id,
            is_owner: is_first_user,
            account: new_account,
            jwt_token,
            is_new_user: true,
        })
    }
}

/// 处理 QQ OAuth 流程
/// 
/// 新流程：
/// - 老用户：直接返回 Reader 信息
/// - 新用户：只创建 Account，不创建 Reader（等用户选择绑定或跳过后再创建）
async fn handle_qq_oauth(
    code: String,
    config: &State<OAuthConfig>,
    db: &State<Database>,
) -> Result<OAuthLoginResult, Json<ApiResponse<()>>> {
    // QQ OAuth 使用第三方接口，不需要配置密钥

    // 1. 创建 QQ OAuth 服务
    let qq_service = QQOAuthService::new(
        config.qq_redirect_uri(),
    );

    // 2. 执行 OAuth 流程
    let (qq_user, openid, access_token) = qq_service
        .oauth_flow(&code)
        .await
        .map_err(|e| {
            log::error!("QQ OAuth 流程失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: format!("QQ OAuth 失败: {}", e),
                data: (),
            })
        })?;

    // 3. 检查账号是否已存在
    let reader_repo = ReaderRepository::new(db);
    let account_repo = AccountRepository::new(db);

    let existing_account = account_repo
        .find_by_provider_and_account_id("qq", &openid)
        .await
        .map_err(|e| {
            log::error!("查询 QQ 账号失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?;

    if let Some(existing_account) = existing_account {
        // 老用户：账号已存在，获取对应的 Reader
        let reader = reader_repo
            .find_by_id(existing_account.user_id)
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
                log::error!("Reader 不存在: user_id={}", existing_account.user_id);
                Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: "用户数据不一致".to_string(),
                    data: (),
                })
            })?;
        
        // 生成 JWT token
        let jwt_token = generate_jwt(reader.id, reader.is_owner, &config.jwt_secret).map_err(|e| {
            log::error!("生成 JWT 失败: {:?}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "生成令牌失败".to_string(),
                data: (),
            })
        })?;

        Ok(OAuthLoginResult {
            jwt_user_id: reader.id,
            is_owner: reader.is_owner,
            account: existing_account,
            jwt_token,
            is_new_user: false,
        })
    } else {
        // 新用户：只创建 Account，不创建 Reader
        // 使用 Account 的 ID 作为临时 userId（后续绑定或跳过时会更新）
        let account_id = ObjectId::new();
        
        // 检查是否是第一个用户（自动设为 Owner）
        let is_first_user = reader_repo.is_empty().await.map_err(|e| {
            log::error!("检查 readers 集合失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "数据库查询失败".to_string(),
                data: (),
            })
        })?;

        // 创建 Account（userId 暂时设为 account_id，后续会更新）
        // 保存 OAuth 用户信息，以便跳过绑定时创建 Reader
        let mut new_account = Account::new_qq_with_info(
            account_id,
            openid,
            access_token,
            qq_user.nickname.clone(),
            qq_user.figureurl_qq_2.clone().unwrap_or(qq_user.figureurl_qq_1.clone()),
        );
        new_account.id = account_id;

        account_repo.create_account(&new_account).await.map_err(|e| {
            log::error!("创建 Account 失败: {}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "创建账号关联失败".to_string(),
                data: (),
            })
        })?;

        log::info!("新用户 QQ OAuth 登录: account_id={}, 等待用户选择绑定或跳过", account_id);

        // 生成 JWT token（使用 account_id 作为临时 user_id）
        let jwt_token = generate_jwt(account_id, is_first_user, &config.jwt_secret).map_err(|e| {
            log::error!("生成 JWT 失败: {:?}", e);
            Json(ApiResponse {
                code: 500,
                status: ResponseStatus::Failed,
                message: "生成令牌失败".to_string(),
                data: (),
            })
        })?;

        Ok(OAuthLoginResult {
            jwt_user_id: account_id,
            is_owner: is_first_user,
            account: new_account,
            jwt_token,
            is_new_user: true,
        })
    }
}