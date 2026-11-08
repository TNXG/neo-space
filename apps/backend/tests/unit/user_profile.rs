use super::UpdateProfileRequest;
use crate::{auth::extractors::AuthUser, error::AppError};
use bson::oid::ObjectId;
use serde_json::json;

fn auth_user(is_owner: bool) -> AuthUser {
    AuthUser {
        user_id: ObjectId::new(),
        is_owner,
    }
}

#[test]
fn readers_cannot_submit_owner_metadata() {
    for payload in [
        json!({ "name": "Reader", "introduce": "Bio" }),
        json!({ "url": "https://example.com" }),
        json!({ "socialIds": { "github": "reader" } }),
        json!({ "introduce": null }),
        json!({ "url": null }),
        json!({ "socialIds": null }),
    ] {
        let request: UpdateProfileRequest = serde_json::from_value(payload).unwrap();
        assert!(matches!(
            request.authorize(&auth_user(false)),
            Err(AppError::Forbidden)
        ));
    }
}

#[test]
fn readers_can_submit_basic_profile_fields() {
    let request: UpdateProfileRequest = serde_json::from_value(json!({
        "name": "Reader",
        "username": "reader_handle",
        "avatar": "https://example.com/avatar.png",
        "mail": "reader@example.com"
    }))
    .unwrap();
    assert!(request.authorize(&auth_user(false)).is_ok());
    assert_eq!(request.handle.as_deref(), Some("reader_handle"));
    assert_eq!(request.email.as_deref(), Some("reader@example.com"));
}

#[test]
fn owners_can_submit_metadata_with_nullable_social_ids() {
    let request: UpdateProfileRequest = serde_json::from_value(json!({
        "introduce": "Bio",
        "url": "https://example.com",
        "socialIds": { "github": "owner", "twitter": null }
    }))
    .unwrap();
    assert!(request.authorize(&auth_user(true)).is_ok());
    let social_ids = request.social_ids.flatten().unwrap();
    assert_eq!(social_ids.github.as_deref(), Some("owner"));
    assert!(social_ids.twitter.is_none());
}
