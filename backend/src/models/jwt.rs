//! JWT Claims model for authentication

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/// JWT Claims structure
/// Only contains user_id (as sub) and is_owner flag
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: String,  // user_id (ObjectId as hex string)
    pub is_owner: bool,
    pub exp: i64,  // Expiration time (Unix timestamp)
    pub iat: i64,  // Issued at (Unix timestamp)
}

impl JwtClaims {
    /// Create new JWT claims with 7-day expiration
    pub fn new(user_id: ObjectId, is_owner: bool) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            sub: user_id.to_hex(),
            is_owner,
            exp: now + 7 * 24 * 60 * 60,  // 7 days from now
            iat: now,
        }
    }

    /// Check if the token is expired
    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        self.exp < now
    }

    /// Get user_id as ObjectId
    pub fn user_id(&self) -> Result<ObjectId, bson::oid::Error> {
        ObjectId::parse_str(&self.sub)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_claims_creation() {
        let user_id = ObjectId::new();
        let claims = JwtClaims::new(user_id, false);

        assert_eq!(claims.sub, user_id.to_hex());
        assert_eq!(claims.is_owner, false);
        assert!(!claims.is_expired());
    }

    #[test]
    fn test_jwt_claims_expiration() {
        let user_id = ObjectId::new();
        let claims = JwtClaims::new(user_id, true);

        // Should expire in 7 days
        let expected_duration = 7 * 24 * 60 * 60;
        let actual_duration = claims.exp - claims.iat;
        assert_eq!(actual_duration, expected_duration);
    }

    #[test]
    fn test_jwt_claims_user_id_parsing() {
        let user_id = ObjectId::new();
        let claims = JwtClaims::new(user_id, false);

        let parsed_id = claims.user_id().unwrap();
        assert_eq!(parsed_id, user_id);
    }
}
