//! Request logging middleware – one line per request with status, latency, IP, and UA.

use axum::{extract::ConnectInfo, extract::Request, middleware::Next, response::Response};
use std::{net::SocketAddr, time::Instant};

pub async fn log_request(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    req: Request,
    next: Next,
) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_owned();

    // Prefer proxy-forwarded headers, fall back to real socket address.
    let ip = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(str::trim)
        .or_else(|| req.headers().get("x-real-ip").and_then(|v| v.to_str().ok()))
        .or_else(|| {
            req.headers()
                .get("cf-connecting-ip")
                .and_then(|v| v.to_str().ok())
        })
        .map(str::to_owned)
        .unwrap_or_else(|| peer.ip().to_string());

    // Extract User-Agent
    let ua = req
        .headers()
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_owned();

    let start = Instant::now();
    let res = next.run(req).await;
    let latency_ms = start.elapsed().as_millis();

    let status = res.status().as_u16();

    tracing::info!(
        method  = %method,
        path    = %path,
        status,
        latency_ms,
        ip      = %ip,
        ua      = %ua,
        "access"
    );

    res
}
