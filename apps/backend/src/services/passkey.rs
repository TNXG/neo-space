//! Passkey WebAuthn 配置与一次性挑战状态管理。

use std::time::Duration;

use bson::oid::ObjectId;
use moka::future::Cache;
use passkey_auth::{Attachment, AuthenticationState, RegistrationState, Webauthn};
use reqwest::Url;

/// 注册挑战对应的服务端状态。
#[derive(Clone)]
pub struct RegistrationChallenge {
    pub user_id: ObjectId,
    pub state: RegistrationState,
}

/// 登录挑战对应的服务端状态。
#[derive(Clone)]
pub struct AuthenticationChallenge {
    pub user_id: ObjectId,
    pub state: AuthenticationState,
}

/// WebAuthn 实例及短期挑战缓存。
#[derive(Clone)]
pub struct PasskeyService {
    pub webauthn: Webauthn,
    pub registration_challenges: Cache<String, RegistrationChallenge>,
    pub authentication_challenges: Cache<String, AuthenticationChallenge>,
}

impl PasskeyService {
    /// 根据后台实际访问 Origin 创建 WebAuthn RP；配置非法时禁用 Passkey，不阻止后端启动。
    pub fn from_backend_url(backend_url: &str) -> Option<Self> {
        let origin = match Url::parse(backend_url) {
            Ok(origin) => origin,
            Err(error) => {
                tracing::error!(%error, "BACKEND_URL 无法用于 Passkey Origin");
                return None;
            }
        };
        let relying_party_id = match origin.host_str() {
            Some(host) => host,
            None => {
                tracing::error!("BACKEND_URL 缺少主机名，Passkey 已禁用");
                return None;
            }
        };
        // WebAuthn 校验的是浏览器 Origin，不包含路径和尾部斜杠。
        let browser_origin = origin.origin().ascii_serialization();
        let webauthn = Webauthn::new(relying_party_id, "Neo Space Admin", &browser_origin)
            .require_user_verification(true)
            .strict_base64(true)
            .authenticator_attachment(Attachment::Any);
        let challenge_ttl = Duration::from_secs(300);

        Some(Self {
            webauthn,
            registration_challenges: Cache::builder()
                .time_to_live(challenge_ttl)
                .max_capacity(100)
                .build(),
            authentication_challenges: Cache::builder()
                .time_to_live(challenge_ttl)
                .max_capacity(100)
                .build(),
        })
    }
}
