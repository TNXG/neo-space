//! 托管服务商检测模块
//!
//! 通过 HTTP 响应头特征识别网站部署的托管平台

use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// 部署服务商类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema, Default)]
#[serde(rename_all = "lowercase")]
pub enum HostingProvider {
    // -----------------------------------------------------
    // SaaS / PaaS / Edge (静态托管与边缘计算平台)
    // -----------------------------------------------------
    Vercel,
    Cloudflare,
    Netlify,
    GitHub,
    Render,
    Railway,
    Fly,
    Heroku,
    /// 腾讯云 `EdgeOne` Pages
    TencentEdgeOnePages,

    // -----------------------------------------------------
    // Tencent Cloud (Infrastructure / CDN)
    // -----------------------------------------------------
    /// `EdgeOne` 边缘安全加速 (动态/全站加速)
    TencentEdgeOne,
    /// 传统 CDN
    TencentCDN,
    /// 通用/CVM
    Tencent,

    // -----------------------------------------------------
    // Aliyun (Alibaba Cloud)
    // -----------------------------------------------------
    /// 边缘安全加速 (ESA)
    AliyunESA,
    /// 传统 CDN / 全站加速
    AliyunCDN,
    /// 通用/ECS/Tengine
    Aliyun,

    // -----------------------------------------------------
    // Global Cloud Providers
    // -----------------------------------------------------
    AWS,
    Azure,
    GCP,
    QuicCloud,

    // -----------------------------------------------------
    // Web Servers
    // -----------------------------------------------------
    OpenResty,
    Nginx,
    Caddy,
    Apache,
    LiteSpeed,

    #[default]
    Unknown,
}

/// 托管服务商检测器
pub struct HostingDetector;

impl HostingDetector {
    /// 通过 HTTP 响应头检测部署服务商
    pub fn detect(response: &reqwest::Response) -> HostingProvider {
        Self::detect_from_headers(response.headers())
    }

    /// 从 `HeaderMap` 检测托管服务商
    pub fn detect_from_headers(headers: &HeaderMap) -> HostingProvider {
        // 预处理 Server 头
        let server_header = headers
            .get("server")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();

        // 预处理 Via 头 (对阿里云 ESA 判断很重要)
        let via_header = headers
            .get("via")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();

        // =========================================================
        // 1. SaaS / PaaS / Edge 平台 (特征最明显，优先判断)
        // =========================================================

        // Tencent EdgeOne Pages
        if server_header.contains("edgeone-pages") {
            return HostingProvider::TencentEdgeOnePages;
        }

        // Vercel
        if headers.contains_key("x-vercel-id")
            || headers.contains_key("x-vercel-cache")
            || server_header.contains("vercel")
        {
            return HostingProvider::Vercel;
        }

        // Quic.Cloud
        if headers.contains_key("x-qc-cache")
            || headers.contains_key("x-qc-pop")
            || headers.contains_key("x-qc-img-optimized")
        {
            return HostingProvider::QuicCloud;
        }

        // Cloudflare
        // 注意：许多 PaaS (如 Render) 底层也用 CF，但通常会覆盖 Server 头。
        // CF-Ray 是最强的 Cloudflare 基础设施指纹。
        if headers.contains_key("cf-ray") || headers.contains_key("cf-cache-status") {
            return HostingProvider::Cloudflare;
        }

        // Netlify
        if headers.contains_key("x-nf-request-id") || server_header.contains("netlify") {
            return HostingProvider::Netlify;
        }

        // GitHub Pages
        if server_header.contains("github") {
            return HostingProvider::GitHub;
        }

        // Render
        if headers.contains_key("x-render-origin-server") {
            return HostingProvider::Render;
        }

        // Railway
        if server_header.contains("railway") {
            return HostingProvider::Railway;
        }

        // Fly.io
        if headers.contains_key("fly-request-id") || server_header.contains("fly.io") {
            return HostingProvider::Fly;
        }

        // Heroku
        if headers.contains_key("x-heroku-queue-depth")
            || headers.contains_key("x-heroku-request-id")
            || headers.contains_key("x-request-id") && server_header.contains("cowboy")
        // Heroku Vegur proxy
        {
            return HostingProvider::Heroku;
        }

        // =========================================================
        // 2. 国内云厂商
        // =========================================================

        // --- 腾讯云 Tencent Cloud ---

        // Tencent EdgeOne (边缘安全加速 - 动态/通用)
        // 区别于 Pages，这里通常是代理模式。
        // 特征：eo-cache-status, eo-log-uuid
        if headers.contains_key("eo-cache-status")
            || headers.contains_key("eo-log-uuid")
            || headers.contains_key("x-eo-id")
        {
            return HostingProvider::TencentEdgeOne;
        }

        // Tencent CDN (传统内容分发网络)
        // 核心特征：x-nws-log-uuid (NWS = New Web Server)
        if headers.contains_key("x-nws-log-uuid")
            || headers.contains_key("x-daa-tunnel")
            || server_header.contains("nws")
            || server_header.contains("tencent-cdn")
        {
            return HostingProvider::TencentCDN;
        }

        // --- 阿里云 Alibaba Cloud ---

        // Aliyun ESA (边缘安全加速)
        // 交叉验证特征：
        // 1. Via 头明确包含 "ens-cache" (Edge Node Service) -> 最准
        // 2. x-esa-rayid 存在 -> 准
        // 3. eagleid 存在 且 Server 是 ESA -> 准
        let has_eagleid = headers.contains_key("eagleid");

        if via_header.contains("ens-cache")
            || headers.contains_key("x-esa-rayid")
            || headers.contains_key("x-esa-request-id")
            || (server_header == "esa" && has_eagleid)
        {
            return HostingProvider::AliyunESA;
        }

        // Aliyun CDN / DCDN (传统 CDN)
        // 特征：eagleid, x-swift-savetime
        if has_eagleid
            || headers.contains_key("x-swift-savetime")
            || headers.contains_key("timing-allow-origin")
        {
            return HostingProvider::AliyunCDN;
        }

        // =========================================================
        // 3. 国际云大厂 (Infrastructure)
        // =========================================================

        // AWS (CloudFront / ALB / S3)
        if headers.contains_key("x-amz-cf-id")
            || headers.contains_key("x-amzn-requestid")
            || server_header.contains("amazon")
            || server_header.contains("cloudfront")
        {
            return HostingProvider::AWS;
        }

        // Azure
        if headers.contains_key("x-azure-ref") || server_header.contains("azure") {
            return HostingProvider::Azure;
        }

        // GCP
        if headers.contains_key("x-cloud-trace-context")
            || headers.contains_key("x-goog-stored-content-length")
            || server_header.contains("google")
            || server_header.contains("gfe")
        // Google Front End
        {
            return HostingProvider::GCP;
        }

        // =========================================================
        // 4. 通用 Web Server
        // =========================================================

        // OpenResty (基于 Nginx，必须先判断)
        if server_header.contains("openresty") {
            return HostingProvider::OpenResty;
        }

        // LiteSpeed
        if server_header.contains("litespeed") {
            return HostingProvider::LiteSpeed;
        }

        // Caddy
        if server_header.contains("caddy") {
            return HostingProvider::Caddy;
        }

        // Nginx
        if server_header.contains("nginx") {
            return HostingProvider::Nginx;
        }

        // Apache
        if server_header.contains("apache") {
            return HostingProvider::Apache;
        }

        HostingProvider::Unknown
    }
}
