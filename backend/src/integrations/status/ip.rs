//! IP 地理位置查询服务
//!
//! 使用 Bilibili API 查询 IP 地址的地理位置信息

use serde::Deserialize;

/// Bilibili IP API 响应数据结构
#[derive(Debug, Deserialize)]
struct BilibiliIpResponse {
    code: i32,
    data: Option<BilibiliIpData>,
}

/// Bilibili IP 数据结构
#[derive(Debug, Deserialize)]
struct BilibiliIpData {
    #[allow(dead_code)]
    addr: String,
    country: String,
    province: String,
    #[allow(dead_code)]
    city: String,
    #[allow(dead_code)]
    isp: String,
}

/// IP 地理位置服务
pub struct IpService {
    client: reqwest::Client,
}

impl Default for IpService {
    fn default() -> Self {
        Self::new()
    }
}

impl IpService {
    /// 创建 IP 服务实例
    ///
    /// # Returns
    /// * `Self` - 服务实例
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
        }
    }

    /// 查询 IP 地址的地理位置（异步）
    ///
    /// # Arguments
    /// * `ip` - IP 地址字符串（支持 IPv4 和 IPv6）
    ///
    /// # Returns
    /// * `Option<String>` - 成功返回省级地理位置信息，失败返回 "未知"
    pub async fn get_location(&self, ip: &str) -> Option<String> {
        let url = format!(
            "https://api.live.bilibili.com/client/v1/Ip/getInfoNew?ip={ip}"
        );

        match self.client.get(&url).send().await {
            Ok(response) => {
                match response.json::<BilibiliIpResponse>().await {
                    Ok(result) => {
                        if result.code == 0 {
                            if let Some(data) = result.data {
                                // 优先返回省份，没有省份则返回国家
                                if !data.province.is_empty() && data.province != "0" {
                                    Some(data.province)
                                } else if !data.country.is_empty() && data.country != "0" {
                                    Some(data.country)
                                } else {
                                    Some("未知".to_string())
                                }
                            } else {
                                Some("未知".to_string())
                            }
                        } else {
                            Some("未知".to_string())
                        }
                    }
                    Err(_) => Some("未知".to_string()),
                }
            }
            Err(_) => Some("未知".to_string()),
        }
    }
}
