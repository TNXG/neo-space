use super::network::{NetworkOptions, build_client, bypass_proxy};
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpListener};

// Removing the explicit proxy must make the public-host request fail DNS instead of reaching this listener.
#[tokio::test]
async fn configured_http_requests_reach_proxy_with_absolute_target() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind proxy");
    let address = listener.local_addr().expect("proxy address");
    let proxy = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("accept request");
        let mut bytes = [0; 4096];
        let count = socket.read(&mut bytes).await.expect("read proxy request");
        let request = String::from_utf8_lossy(bytes.get(..count).expect("request bytes")).to_string();
        socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nproxied").await.expect("reply");
        request
    });
    let options = NetworkOptions { proxy_url: format!("http://{address}") };
    let client = build_client(&options, &[]).expect("build transport");
    assert_eq!(client.get("http://proxy-target.invalid/example").send().await.expect("proxy response").text().await.expect("body"), "proxied");
    assert!(proxy.await.expect("proxy task").starts_with("GET http://proxy-target.invalid/example HTTP/1.1"));
}

// A disabled setting must retain the direct path, rather than consulting ambient HTTP_PROXY.
#[tokio::test]
async fn disabled_proxy_reaches_direct_origin() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind origin");
    let address = listener.local_addr().expect("origin address");
    let origin = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("accept origin");
        let mut bytes = [0; 4096];
        let count = socket.read(&mut bytes).await.expect("read origin request");
        let request = String::from_utf8_lossy(bytes.get(..count).expect("request bytes")).to_string();
        socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\ndirect").await.expect("reply");
        request
    });
    let client = build_client(&NetworkOptions::default(), &[]).expect("direct client");
    assert_eq!(client.get(format!("http://{address}/direct")).send().await.expect("direct response").text().await.expect("body"), "direct");
    assert!(origin.await.expect("origin task").starts_with("GET /direct HTTP/1.1"));
}

#[test]
fn invalid_proxy_is_rejected_without_echoing_credentials() {
    for value in [
        "not a url",
        "http://user:secret@host/path",
        "https://host/#fragment",
        "socks4://user:secret@localhost:1080",
        "socks4a://localhost:1080",
        "socks5://user:secret@host/path",
        "ftp://user:secret@localhost:21",
    ] {
        let error = NetworkOptions { proxy_url: value.into() }.validate().expect_err("invalid setting");
        assert!(!error.contains("secret"));
        assert!(!error.contains(value));
    }
}

#[test]
fn socks5_proxy_urls_are_accepted_and_normalized() {
    let url = NetworkOptions { proxy_url: "socks5://user:secret@localhost".into() }
        .validate().expect("valid socks proxy").expect("enabled");
    assert_eq!((url.scheme(), url.host_str(), url.port(), url.path()), ("socks5h", Some("localhost"), Some(1080), "/"));
    assert_eq!((url.username(), url.password()), ("user", Some("secret")));
    let remote = NetworkOptions { proxy_url: "socks5h://localhost:9050".into() }
        .validate().expect("valid remote-DNS socks proxy").expect("enabled");
    assert_eq!((remote.scheme(), remote.port()), ("socks5h", Some(9050)));
    for value in ["socks5://user@localhost:1080", "socks5://user:@localhost:1080", "socks5://:secret@localhost:1080"] {
        assert!(NetworkOptions { proxy_url: value.into() }.validate().is_err(), "incomplete SOCKS credentials must be rejected");
    }
}

#[test]
fn topology_bypass_is_explicit_and_does_not_cover_public_integrations() {
    let origins = vec!["https://api.example.com".to_string()];
    for value in ["http://127.0.0.1/x", "http://10.0.0.1", "http://[::1]", "http://meilisearch:7700", "https://api.example.com/api"] {
        assert!(bypass_proxy(&reqwest::Url::parse(value).expect("URL"), &origins));
    }
    assert!(!bypass_proxy(&reqwest::Url::parse("https://api.github.com/user").expect("URL"), &origins));
}

#[test]
fn proxy_requires_internal_secret_but_direct_deployments_do_not() {
    assert!(NetworkOptions::default().validate_deployment(None).is_ok());
    let options = NetworkOptions { proxy_url: "http://user:secret@localhost:3128".into() };
    assert!(options.validate_deployment(None).is_err());
    assert!(options.validate_deployment(Some("")).is_err());
    assert!(options.validate_deployment(Some("shared-internal-secret")).is_ok());
}

#[tokio::test]
async fn https_requests_issue_authenticated_connect_to_proxy() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind proxy");
    let address = listener.local_addr().expect("proxy address");
    let proxy = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("accept CONNECT");
        let mut bytes = [0; 4096];
        let count = socket.read(&mut bytes).await.expect("read CONNECT");
        let request = String::from_utf8_lossy(bytes.get(..count).expect("request")).to_string();
        socket.write_all(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.expect("reject tunnel");
        request
    });
    let options = NetworkOptions { proxy_url: format!("http://user:secret@{address}") };
    let client = build_client(&options, &[]).expect("transport");
    let error = client.get("https://proxy-target.invalid/path").send().await.expect_err("fixture rejects tunnel");
    assert!(!error.to_string().contains("secret"));
    let request = proxy.await.expect("proxy task");
    assert!(request.starts_with("CONNECT proxy-target.invalid:443 HTTP/1.1"));
    assert!(request.to_ascii_lowercase().contains("proxy-authorization: basic dxnlcjpzzwnyzxq="));
}

// SOCKS5 carries credentials in RFC 1929 (from the proxy URL), not in an HTTP proxy header.
#[tokio::test]
async fn socks5h_proxy_authenticates_and_tunnels_the_remote_host() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind socks proxy");
    let address = listener.local_addr().expect("proxy address");
    let proxy = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("accept socks client");
        let mut greeting = [0u8; 2];
        socket.read_exact(&mut greeting).await.expect("greeting header");
        assert_eq!(greeting, [5, 1]);
        let mut method = [0u8; 1];
        socket.read_exact(&mut method).await.expect("auth method");
        assert_eq!(method, [2]);
        socket.write_all(&[5, 2]).await.expect("select username/password");
        let mut auth_header = [0u8; 2];
        socket.read_exact(&mut auth_header).await.expect("auth header");
        assert_eq!(auth_header[0], 1);
        let mut username = vec![0u8; usize::from(auth_header[1])];
        socket.read_exact(&mut username).await.expect("auth username");
        let mut password_length = [0u8; 1];
        socket.read_exact(&mut password_length).await.expect("password length");
        let mut password = vec![0u8; usize::from(password_length[0])];
        socket.read_exact(&mut password).await.expect("auth password");
        socket.write_all(&[1, 0]).await.expect("accept credentials");
        let mut connect = [0u8; 4];
        socket.read_exact(&mut connect).await.expect("connect header");
        assert_eq!(connect, [5, 1, 0, 3]);
        let mut host_length = [0u8; 1];
        socket.read_exact(&mut host_length).await.expect("host length");
        let mut host = vec![0u8; usize::from(host_length[0])];
        socket.read_exact(&mut host).await.expect("host");
        let mut port = [0u8; 2];
        socket.read_exact(&mut port).await.expect("port");
        socket.write_all(&[5, 0, 0, 1, 0, 0, 0, 0, 0, 0]).await.expect("open tunnel");
        let mut bytes = [0; 4096];
        let count = socket.read(&mut bytes).await.expect("tunneled request");
        let request = String::from_utf8_lossy(bytes.get(..count).expect("request bytes")).to_string();
        socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nproxied").await.expect("reply");
        (String::from_utf8(username).expect("username"), String::from_utf8(password).expect("password"),
            String::from_utf8_lossy(&host).to_string(), u16::from_be_bytes(port), request)
    });
    let options = NetworkOptions { proxy_url: format!("socks5h://user:secret@{address}") };
    let client = build_client(&options, &[]).expect("build transport");
    assert_eq!(client.get("http://proxy-target.invalid/example").send().await.expect("proxy response").text().await.expect("body"), "proxied");
    let (username, password, host, port, request) = proxy.await.expect("proxy task");
    assert_eq!((username.as_str(), password.as_str()), ("user", "secret"));
    assert_eq!((host.as_str(), port), ("proxy-target.invalid", 80));
    assert!(request.starts_with("GET /example HTTP/1.1"));
}

#[tokio::test]
async fn configured_proxy_does_not_receive_local_traffic_or_leak_auth_to_origin() {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind local origin");
    let address = listener.local_addr().expect("origin address");
    let origin = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("direct connection");
        let mut bytes = [0; 4096];
        let count = socket.read(&mut bytes).await.expect("origin request");
        let request = String::from_utf8_lossy(bytes.get(..count).expect("request")).to_string();
        socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.expect("response");
        request
    });
    let options = NetworkOptions { proxy_url: "http://user:secret@127.0.0.1:1".into() };
    let client = build_client(&options, &[]).expect("transport");
    assert!(client.get(format!("http://{address}/local")).send().await.expect("direct response").status().is_success());
    let request = origin.await.expect("origin task");
    assert!(request.starts_with("GET /local HTTP/1.1"));
    assert!(!request.to_ascii_lowercase().contains("proxy-authorization"));
    assert!(!request.contains("secret"));
}
