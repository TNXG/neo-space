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
    /// 根据前端浏览器 Origin 创建 WebAuthn RP；配置非法时禁用 Passkey，不阻止后端启动。
    pub fn from_frontend_url(frontend_url: &str) -> Option<Self> {
        let origin = match Url::parse(frontend_url) {
            Ok(origin) => origin,
            Err(error) => {
                tracing::error!(%error, "FRONTEND_URL 无法用于 Passkey Origin");
                return None;
            }
        };
        let relying_party_id = match origin.host_str() {
            Some(host) => host,
            None => {
                tracing::error!("FRONTEND_URL 缺少主机名，Passkey 已禁用");
                return None;
            }
        };
        // 库仅保存 Origin，不校验安全上下文；HTTP 仅允许本机开发。
        let is_localhost = relying_party_id == "localhost"
            || relying_party_id
                .parse::<std::net::Ipv4Addr>()
                .is_ok_and(|address| address.is_loopback());
        if !matches!(origin.scheme(), "https" | "http")
            || (origin.scheme() == "http" && !is_localhost)
            || relying_party_id.contains(':')
        {
            tracing::error!("FRONTEND_URL 必须是 HTTPS 或本机 HTTP，且使用合法 RP 主机名，Passkey 已禁用");
            return None;
        }
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

#[cfg(test)]
mod tests {
    use super::PasskeyService;
    use passkey_auth::{Challenge, Error, RegistrationResponse};

    #[tokio::test]
    async fn frontend_origin_drives_challenges_and_registration_verification() {
        let service = PasskeyService::from_frontend_url("https://dashboard.example.com:8443/admin/")
            .expect("valid frontend URL");
        let (challenge, state) =
            service.webauthn.start_registration(b"owner", "owner", "Owner", &[]);
        assert_eq!(challenge.rp.id, "dashboard.example.com");
        let (authentication, _) = service.webauthn.start_authentication(&[]);
        assert_eq!(authentication.rp_id, "dashboard.example.com");

        for origin in [
            "https://dashboard.example.com:8443",
            "https://api.example.com",
            "https://dashboard.example.com",
        ] {
            let client_data = serde_json::json!({
                "type": "webauthn.create",
                "challenge": challenge.challenge,
                "origin": origin,
                "crossOrigin": false,
            });
            let response = RegistrationResponse {
                id: String::new(),
                transports: Vec::new(),
                attestation_object: String::new(),
                client_data_json: Challenge(client_data.to_string().into_bytes()).to_b64url(),
            };
            let error = service
                .webauthn
                .finish_registration(&state, &response)
                .expect_err("incomplete attestation must never register a credential");
            if origin == "https://dashboard.example.com:8443" {
                // Exact frontend Origin passes client-data verification and reaches CBOR parsing.
                assert!(matches!(error, Error::Cbor(_)), "{error:?}");
            } else {
                assert!(matches!(error, Error::OriginMismatch { .. }), "{error:?}");
            }
        }
    }

    #[tokio::test]
    async fn insecure_and_non_http_frontend_origins_are_disabled() {
        for url in [
            "http://dashboard.example.com",
            "ftp://dashboard.example.com",
            "file:///admin",
            "not a URL",
            "https://[::1]",
        ] {
            assert!(PasskeyService::from_frontend_url(url).is_none(), "{url}");
        }
        for url in ["https://dashboard.example.com", "http://localhost:3000", "http://127.0.0.1:3000"] {
            assert!(PasskeyService::from_frontend_url(url).is_some(), "{url}");
        }
    }
}
