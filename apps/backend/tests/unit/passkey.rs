#![allow(clippy::expect_used)]

use super::PasskeyService;
use passkey_auth::{Challenge, Error, RegistrationResponse};

#[tokio::test]
async fn frontend_origin_drives_challenges_and_registration_verification() {
    let service = PasskeyService::from_frontend_url("https://dashboard.example.com:8443/admin/")
        .expect("valid frontend URL");
    let (challenge, state) = service
        .webauthn
        .start_registration(b"owner", "owner", "Owner", &[]);
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
    for url in [
        "https://dashboard.example.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ] {
        assert!(PasskeyService::from_frontend_url(url).is_some(), "{url}");
    }
}
