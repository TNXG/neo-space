//! 认证路由 - OAuth 登录实现

use mongodb::Database;
use rocket::http::{Cookie, CookieJar, SameSite};
use rocket::serde::json::Json;
use rocket::{State, response::Redirect};

use crate::config::OAuthConfig;
use crate::models::ApiResponse;
use crate::repositories::OptionsRepository;
use crate::services::auth::identity::{IdentityService, OAuthUserPayload};
use crate::services::{OAuthProviderType, OAuthService, OAuthUserInfo};

/// OAuth 重定向端点
///
/// 路由: GET /api/auth/oauth/<provider>
#[get("/oauth/<provider>")]
pub async fn oauth_redirect(
    provider: &str,
    config: &State<OAuthConfig>,
    db: &State<Database>,
) -> Result<Redirect, Json<ApiResponse<()>>> {
    log::info!("OAuth 重定向请求: provider={provider}");

    // 1. 获取最新的 OAuth 配置（数据库优先）
    let options_repo = OptionsRepository::new(db);
    let db_oauth_options = options_repo.get_oauth_config().await.map_err(|e| {
        log::error!("读取数据库配置失败: {e}");
        ApiResponse::internal_error("读取配置失败".to_string())
    })?;

    let redirect_url = match provider {
        "github" => {
            let client_id = db_oauth_options
                .github_client_id
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| config.github_client_id.clone());

            if client_id.is_empty() {
                return Err(ApiResponse::internal_error(
                    "GitHub OAuth 未配置".to_string(),
                ));
            }

            format!(
                "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=user:email",
                client_id,
                urlencoding::encode(&config.github_redirect_uri())
            )
        }
        "qq" => {
            // QQ OAuth 使用统一的服务
            let oauth_service = OAuthService::new(None, None, Some(config.qq_redirect_uri()));
            oauth_service.get_qq_authorize_url().unwrap_or_else(|_| {
                format!(
                    "https://api-space.tnxg.top/oauth/qq/authorize?redirect=true&return_url={}",
                    urlencoding::encode(&config.qq_redirect_uri())
                )
            })
        }
        _ => {
            return Err(ApiResponse::bad_request(format!(
                "不支持的提供商: {provider}"
            )));
        }
    };

    Ok(Redirect::to(redirect_url))
}

/// OAuth 回调端点
///
/// 路由: GET /api/auth/oauth/<provider>/callback?code=xxx
#[get("/oauth/<provider>/callback?<code>")]
pub async fn oauth_callback(
    provider: &str,
    code: String,
    config: &State<OAuthConfig>,
    db: &State<Database>,
    cookies: &CookieJar<'_>,
) -> Result<Redirect, Json<ApiResponse<()>>> {
    log::info!("OAuth 回调处理开始: provider={provider}");

    // 1. 获取第三方用户信息并转换为标准 Payload
    let payload_result = match provider {
        "github" => handle_github_logic(&code, config, db).await,
        "qq" => handle_qq_logic(&code, config, db).await,
        _ => Err(ApiResponse::bad_request("不支持的提供商".to_string())),
    };

    // 如果获取第三方信息失败，重定向到前端并带上错误参数
    let payload = match payload_result {
        Ok(p) => p,
        Err(e) => {
            let err_msg = e.0.message;
            return Ok(Redirect::to(format!(
                "{}/auth/callback?error={}",
                config.frontend_url,
                urlencoding::encode(&err_msg)
            )));
        }
    };

    // 2. 使用 IdentityService 处理复杂的业务逻辑 (自动关联、临时账户等)
    let id_service = IdentityService::new(db, config.jwt_secret.clone());
    let (user_id, is_owner, is_new_user) = match id_service.process_oauth_login(payload).await {
        Ok(res) => res,
        Err(e) => {
            return Ok(Redirect::to(format!(
                "{}/auth/callback?error={}",
                config.frontend_url,
                urlencoding::encode(&e)
            )));
        }
    };

    // 3. 颁发 JWT 令牌
    let token = id_service
        .issue_token(user_id, is_owner)
        .map_err(ApiResponse::internal_error)?;

    // 4. 设置 HttpOnly Cookie（用于后端 API 鉴权）
    let mut cookie = Cookie::new("auth_token", token.clone());
    cookie.set_http_only(true);
    cookie.set_secure(true); // 建议生产环境强制 HTTPS
    cookie.set_same_site(SameSite::Lax);
    cookie.set_path("/");
    cookie.set_max_age(rocket::time::Duration::days(7));
    cookies.add(cookie);

    // 5. 重定向回前端页面
    // 前端会解析 URL 中的 token 和 new_user 标记来决定是进入仪表盘还是进入“绑定/跳过”页面
    let callback_url = format!(
        "{}/auth/callback?token={}&new_user={}",
        config.frontend_url, token, is_new_user
    );

    Ok(Redirect::to(callback_url))
}

// --- 内部逻辑封装：负责与各平台 API 交互 ---

/// 将 `OAuthUserInfo` 转换为 `OAuthUserPayload`
fn convert_to_payload(info: OAuthUserInfo) -> OAuthUserPayload {
    let provider = match info.provider {
        OAuthProviderType::GitHub => "github",
        OAuthProviderType::QQ => "qq",
    }
    .to_string();

    OAuthUserPayload {
        provider,
        provider_id: info.provider_user_id,
        name: info.nickname,
        email: info.email,
        avatar: Some(info.avatar),
        handle: None,
        access_token: info.access_token.unwrap_or_default(),
        scope: None,
    }
}

/// 处理 GitHub 的 OAuth 交换逻辑
async fn handle_github_logic(
    code: &str,
    config: &OAuthConfig,
    db: &Database,
) -> Result<OAuthUserPayload, Json<ApiResponse<()>>> {
    let options_repo = OptionsRepository::new(db);
    let db_oauth = options_repo.get_oauth_config().await.unwrap_or_default();

    let client_id = db_oauth
        .github_client_id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| config.github_client_id.clone());
    let client_secret = db_oauth
        .github_client_secret
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| config.github_client_secret.clone());

    if client_id.is_empty() || client_secret.is_empty() {
        return Err(ApiResponse::internal_error("GitHub 配置缺失".into()));
    }

    // 使用新的统一 OAuth 服务
    let oauth_service = OAuthService::new(
        Some(client_id),
        Some(client_secret),
        None, // QQ redirect_uri
    );

    let user_info = oauth_service
        .exchange_github_code(code)
        .await
        .map_err(|e| ApiResponse::internal_error(format!("GitHub API 调用失败: {e}")))?;

    Ok(convert_to_payload(user_info))
}

/// 处理 QQ 的 OAuth 交换逻辑
async fn handle_qq_logic(
    code: &str,
    config: &OAuthConfig,
    _db: &Database,
) -> Result<OAuthUserPayload, Json<ApiResponse<()>>> {
    // 使用新的统一 OAuth 服务
    let oauth_service = OAuthService::new(
        None, // GitHub credentials
        None,
        Some(config.qq_redirect_uri()),
    );

    let user_info = oauth_service
        .exchange_qq_code(code)
        .await
        .map_err(|e| ApiResponse::internal_error(format!("QQ API 调用失败: {e}")))?;

    Ok(convert_to_payload(user_info))
}
