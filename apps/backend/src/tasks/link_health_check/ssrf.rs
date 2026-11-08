/// Check if a URL points to private/internal networks.
pub fn is_ssrf_url(url: &str) -> bool {
    let url_lower = url.to_lowercase();

    if !url_lower.starts_with("http://") && !url_lower.starts_with("https://") {
        return true;
    }

    let host = url_lower
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");

    if host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "[::1]" {
        return true;
    }

    if let Ok(addr) = host.parse::<std::net::Ipv4Addr>() {
        return addr.is_loopback()
            || addr.is_private()
            || addr.is_link_local()
            || addr.is_broadcast()
            || addr.is_documentation()
            || addr.is_unspecified();
    }

    host == "169.254.169.254"
        || std::path::Path::new(host)
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("local"))
}
