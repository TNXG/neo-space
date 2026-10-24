//! Authenticated reader profile writes and owner-only public metadata.

use crate::{
    app::SharedState,
    auth::extractors::AuthUser,
    error::{AppError, AppResult},
    models::{Reader, ReaderResponse, UserSocialIds},
    tasks::content_change::notify_user_profile_changed,
};
use bson::doc;
use serde::{Deserialize, Deserializer};

/// Profile fields accepted by the existing profile mutation endpoint.
#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    name: Option<String>,
    #[serde(alias = "username")]
    handle: Option<String>,
    #[serde(alias = "avatar")]
    image: Option<String>,
    #[serde(alias = "mail")]
    email: Option<String>,
    #[serde(default, deserialize_with = "deserialize_supplied")]
    introduce: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_supplied")]
    url: Option<Option<String>>,
    #[serde(
        rename = "socialIds",
        default,
        deserialize_with = "deserialize_supplied"
    )]
    social_ids: Option<Option<UserSocialIds>>,
}

/// Keep explicit null distinguishable from omission for owner authorization.
fn deserialize_supplied<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

impl UpdateProfileRequest {
    /// Reject owner-only fields before applying any ordinary reader updates.
    fn authorize(&self, auth_user: &AuthUser) -> AppResult<()> {
        if !auth_user.is_owner
            && (self.introduce.is_some() || self.url.is_some() || self.social_ids.is_some())
        {
            return Err(AppError::Forbidden);
        }
        Ok(())
    }
}

/// Save the caller's profile, then synchronize its public derived state.
pub async fn update_user_profile(
    state: &SharedState,
    auth_user: &AuthUser,
    payload: UpdateProfileRequest,
) -> AppResult<ReaderResponse> {
    payload.authorize(auth_user)?;
    let readers = state.db.collection::<Reader>("readers");
    let owner_profiles = state.db.collection::<bson::Document>("owner_profiles");
    let mut reader_update = doc! {};
    let mut owner_update = doc! {};

    if let Some(name) = payload.name
        && !name.is_empty()
    {
        reader_update.insert("name", name);
    }

    if let Some(handle) = payload.handle
        && !handle.is_empty()
    {
        if !handle
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return Err(AppError::BadRequest("Invalid handle format. Only alphanumeric characters, dashes, and underscores are allowed.".to_string()));
        }
        let occupied = readers
            .find_one(doc! { "handle": &handle, "_id": { "$ne": auth_user.user_id } })
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .is_some();
        if occupied {
            return Err(AppError::BadRequest(
                "Username is already in use".to_string(),
            ));
        }
        reader_update.insert("handle", handle);
    }

    if let Some(image) = payload.image {
        reader_update.insert("image", image);
    }

    if let Some(email) = payload.email {
        let email = email.trim().to_lowercase();
        if !email.contains('@') {
            return Err(AppError::BadRequest("Invalid email address".to_string()));
        }
        reader_update.insert("email", &email);
        owner_update.insert("mail", email);
    }
    if let Some(Some(introduce)) = payload.introduce {
        owner_update.insert("introduce", introduce);
    }
    if let Some(Some(url)) = payload.url {
        owner_update.insert("url", url);
    }
    if let Some(Some(social_ids)) = payload.social_ids {
        owner_update.insert(
            "socialIds",
            bson::to_bson(&social_ids)
                .map_err(|e| AppError::Internal(format!("Failed to encode social IDs: {e}")))?,
        );
    }

    if reader_update.is_empty() && owner_update.is_empty() {
        return Err(AppError::BadRequest("No fields to update".to_string()));
    }

    if !reader_update.is_empty() {
        reader_update.insert("updatedAt", bson::DateTime::now());
        readers
            .update_one(
                doc! { "_id": auth_user.user_id },
                doc! { "$set": reader_update },
            )
            .await
            .map_err(|e| AppError::Database(format!("Failed to update profile: {e}")))?;
    }
    if !owner_update.is_empty() {
        owner_profiles
            .update_one(
                doc! { "readerId": auth_user.user_id },
                doc! { "$set": owner_update },
            )
            .await
            .map_err(|e| AppError::Database(format!("Failed to update owner profile: {e}")))?;
    }

    let updated_reader = readers
        .find_one(doc! { "_id": auth_user.user_id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal(
            "Failed to fetch updated profile".to_string(),
        ))?;

    notify_user_profile_changed(state, &auth_user.user_id, auth_user.is_owner).await;

    Ok(ReaderResponse {
        is_owner: auth_user.is_owner,
        ..ReaderResponse::from(updated_reader)
    })
}

#[cfg(test)]
mod tests {
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
}
