//! 认证路由 - OAuth 登录实现

use mongodb::Database;
use rocket::http::{Cookie, CookieJar, SameSite};
use rocket::serde::json::Json;
use rocket::{response::Redirect, State};

use crate::config::OAuthConfig;
use crate::models::ApiResponse;
use crate::services::auth::identity::{IdentityService, OAuthUserPayload};
use crate::services::{GitHubOAuthService, OptionsRepository, QQOAuthService};

/// OAuth 重定向端点
///
/// 路由: GET /api/auth/oauth/<provider>
#[get("/oauth/<provider>")]
pub async fn oauth_redirect(
    provider: String,
    config: &State<OAuthConfig>,
    db: &State<Database>,
) -> Result<Redirect, Json<ApiResponse<()>>> {
    log::info!("OAuth 重定向请求: provider={}", provider);

    // 1. 获取最新的 OAuth 配置（数据库优先）
    let options_repo = OptionsRepository::new(db);
    let db_oauth_options = options_repo.get_oauth_config().await.map_err(|e| {
        log::error!("读取数据库配置失败: {}", e);
        ApiResponse::internal_error("读取配置失败".to_string())
    })?;

    let redirect_url = match provider.as_str() {
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
            // QQ OAuth 通常使用统一的第三方或预设回调
            let qq_service = QQOAuthService::new(config.qq_redirect_uri());
            qq_service.get_authorize_url()
        }
        _ => {
            return Err(ApiResponse::bad_request(format!(
                "不支持的提供商: {}",
                provider
            )))
        }
    };

    Ok(Redirect::to(redirect_url))
}

/// OAuth 回调端点
///
/// 路由: GET /api/auth/oauth/<provider>/callback?code=xxx
#[get("/oauth/<provider>/callback?<code>")]
pub async fn oauth_callback(
    provider: String,
    code: String,
    config: &State<OAuthConfig>,
    db: &State<Database>,
    cookies: &CookieJar<'_>,
) -> Result<Redirect, Json<ApiResponse<()>>> {
    log::info!("OAuth 回调处理开始: provider={}", provider);

    // 1. 获取第三方用户信息并转换为标准 Payload
    let payload_result = match provider.as_str() {
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
        .map_err(|e| ApiResponse::internal_error(e))?;

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

    let github_service = GitHubOAuthService::new(client_id, client_secret);
    let (user, access_token, scope) = github_service
        .oauth_flow(code)
        .await
        .map_err(|e| ApiResponse::internal_error(format!("GitHub API 调用失败: {}", e)))?;

    Ok(OAuthUserPayload {
        provider: "github".to_string(),
        provider_id: user.id.to_string(), // 这里保持 String，Service 内部会 parse 为 u64
        name: user.name.unwrap_or_else(|| user.login.clone()),
        email: user.email,
        avatar: Some(user.avatar_url),
        handle: Some(user.login),
        access_token,
        scope: Some(scope),
    })
}

/// 处理 QQ 的 OAuth 交换逻辑
async fn handle_qq_logic(
    code: &str,
    config: &OAuthConfig,
    _db: &Database,
) -> Result<OAuthUserPayload, Json<ApiResponse<()>>> {
    let qq_service = QQOAuthService::new(config.qq_redirect_uri());
    let (user, openid, access_token) = qq_service
        .oauth_flow(code)
        .await
        .map_err(|e| ApiResponse::internal_error(format!("QQ API 调用失败: {}", e)))?;

    Ok(OAuthUserPayload {
        provider: "qq".to_string(),
        provider_id: openid,
        name: user.nickname,
        email: None,
        avatar: Some(user.figureurl_qq_2.unwrap_or(user.figureurl_qq_1)),
        handle: None,
        access_token,
        scope: None,
    })
}
