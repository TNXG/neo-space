//! 客户端 IP 地址请求守卫

use rocket::request::{FromRequest, Outcome, Request};
use rocket::http::Status;

/// 客户端 IP 地址
pub struct ClientIp(pub String);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for ClientIp {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // 1. 尝试从 X-Forwarded-For 头获取（代理/负载均衡器）
        if let Some(forwarded_for) = request.headers().get_one("X-Forwarded-For") {
            // X-Forwarded-For 可能包含多个 IP，取第一个（真实客户端 IP）
            let ip = forwarded_for
                .split(',')
                .next()
                .unwrap_or(forwarded_for)
                .trim()
                .to_string();
            
            if !ip.is_empty() {
                return Outcome::Success(ClientIp(ip));
            }
        }

        // 2. 尝试从 X-Real-IP 头获取（Nginx 代理）
        if let Some(real_ip) = request.headers().get_one("X-Real-IP") {
            let ip = real_ip.trim().to_string();
            if !ip.is_empty() {
                return Outcome::Success(ClientIp(ip));
            }
        }

        // 3. 尝试从 CF-Connecting-IP 头获取（Cloudflare）
        if let Some(cf_ip) = request.headers().get_one("CF-Connecting-IP") {
            let ip = cf_ip.trim().to_string();
            if !ip.is_empty() {
                return Outcome::Success(ClientIp(ip));
            }
        }

        // 4. 从远程地址获取
        if let Some(remote_addr) = request.remote() {
            return Outcome::Success(ClientIp(remote_addr.ip().to_string()));
        }

        // 5. 无法获取 IP
        Outcome::Error((Status::BadRequest, ()))
    }
}
