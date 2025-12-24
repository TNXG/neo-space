//! IP 地理位置查询服务
//!
//! 使用 ip2region 库查询 IP 地址的地理位置信息

use ip2region::{CachePolicy, Searcher};
use std::sync::Arc;

/// IP 地理位置服务
pub struct IpService {
    ipv4_searcher: Arc<Searcher>,
    ipv6_searcher: Arc<Searcher>,
}

impl IpService {
    /// 创建 IP 服务实例
    ///
    /// # Arguments
    /// * `ipv4_db_path` - IPv4 数据库文件路径
    /// * `ipv6_db_path` - IPv6 数据库文件路径
    ///
    /// # Returns
    /// * `Result<Self, String>` - 成功返回服务实例，失败返回错误信息
    pub fn new(ipv4_db_path: String, ipv6_db_path: String) -> Result<Self, String> {
        // 使用 VectorIndex 缓存策略，平衡内存和性能
        let ipv4_searcher = Searcher::new(ipv4_db_path, CachePolicy::VectorIndex)
            .map_err(|e| format!("Failed to load IPv4 database: {}", e))?;

        let ipv6_searcher = Searcher::new(ipv6_db_path, CachePolicy::VectorIndex)
            .map_err(|e| format!("Failed to load IPv6 database: {}", e))?;

        Ok(Self {
            ipv4_searcher: Arc::new(ipv4_searcher),
            ipv6_searcher: Arc::new(ipv6_searcher),
        })
    }

    /// 查询 IP 地址的地理位置
    ///
    /// # Arguments
    /// * `ip` - IP 地址字符串（支持 IPv4 和 IPv6）
    ///
    /// # Returns
    /// * `Option<String>` - 成功返回地理位置信息，失败返回 None
    pub fn search(&self, ip: &str) -> Option<String> {
        // 判断是 IPv4 还是 IPv6
        let is_ipv6 = ip.contains(':');

        let searcher = if is_ipv6 {
            &self.ipv6_searcher
        } else {
            &self.ipv4_searcher
        };

        match searcher.search(ip) {
            Ok(result) => {
                // ip2region 返回格式：国家|区域|省份|城市|ISP
                // 例如：中国|0|北京|北京市|电信
                let location = result.to_string();
                
                // 过滤掉无效信息（0 或空）
                let parts: Vec<&str> = location
                    .split('|')
                    .filter(|s| !s.is_empty() && *s != "0")
                    .collect();

                if parts.is_empty() {
                    None
                } else {
                    Some(parts.join(" "))
                }
            }
            Err(e) => {
                log::warn!("Failed to search IP {}: {}", ip, e);
                None
            }
        }
    }

    /// 格式化地理位置信息（简化版 - 只显示省级）
    ///
    /// # Arguments
    /// * `ip` - IP 地址字符串
    ///
    /// # Returns
    /// * `Option<String>` - 返回省级地理位置信息
    pub fn search_simple(&self, ip: &str) -> Option<String> {
        self.search(ip).map(|location| {
            // ip2region 返回格式：国家|区域|省份|城市|ISP
            // 简化显示：只保留省份
            let parts: Vec<&str> = location.split_whitespace().collect();
            
            if parts.len() >= 2 {
                // 返回省份（第二个部分）
                // 如果是直辖市或特别行政区，可能国家和省份相同
                let province = parts[1];
                
                // 过滤掉一些无意义的值
                if province == "0" || province.is_empty() {
                    if parts.len() >= 1 && parts[0] != "0" {
                        return parts[0].to_string();
                    }
                    return "未知".to_string();
                }
                
                province.to_string()
            } else if !parts.is_empty() && parts[0] != "0" {
                // 只有国家信息
                parts[0].to_string()
            } else {
                "未知".to_string()
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ip_service() {
        // 注意：测试需要实际的数据库文件
        let service = IpService::new(
            "data/ip2region_v4.xdb".to_string(),
            "data/ip2region_v6.xdb".to_string(),
        );

        if let Ok(service) = service {
            // 测试 IPv4
            if let Some(location) = service.search("1.1.1.1") {
                println!("1.1.1.1: {}", location);
            }

            // 测试 IPv6
            if let Some(location) = service.search("2001::") {
                println!("2001::: {}", location);
            }
        }
    }
}
