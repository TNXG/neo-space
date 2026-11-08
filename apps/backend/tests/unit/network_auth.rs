use super::*;

#[test]
fn internal_config_rejects_missing_secret_invalid_signature_and_expired_requests() {
    let mut headers = HeaderMap::new();
    assert!(authorize(&headers, "", 100).is_err());
    assert!(authorize(&headers, "secret", 100).is_err());
    headers.insert("x-network-timestamp", "100".parse().expect("header"));
    headers.insert("x-network-signature", "00".parse().expect("header"));
    assert!(authorize(&headers, "secret", 100).is_err());
    let mut mac = Hmac::<Sha256>::new_from_slice(b"secret").expect("HMAC");
    mac.update(b"network-config:100");
    headers.insert("x-network-signature", hex::encode(mac.finalize().into_bytes()).parse().expect("signature"));
    assert!(authorize(&headers, "secret", 100).is_ok());
    assert!(authorize(&headers, "secret", 161).is_err());
}
