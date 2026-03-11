//! IP geolocation service using Bilibili API

use serde::Deserialize;

/// Get IP geolocation using Bilibili API (matches Rocket's IpService)
pub async fn get_ip_location(ip: &str, http_client: &reqwest::Client) -> Option<String> {
    let url = format!("https://api.live.bilibili.com/client/v1/Ip/getInfoNew?ip={ip}");
    match http_client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => {
            #[derive(Deserialize)]
            struct BilibiliIpResponse {
                code: i32,
                data: Option<BilibiliIpData>,
            }
            #[derive(Deserialize)]
            struct BilibiliIpData {
                country: String,
                province: String,
            }
            match response.json::<BilibiliIpResponse>().await {
                Ok(result) => {
                    if result.code == 0 {
                        if let Some(data) = result.data {
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
