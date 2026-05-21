//! JWT token generation and verification

use bson::oid::ObjectId;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

/// JWT error types
#[derive(Debug)]
#[allow(clippy::enum_variant_names)]
pub enum JwtError {
    TokenGenerationFailed(String),
    TokenVerificationFailed(String),
    TokenExpired,
}

impl std::fmt::Display for JwtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JwtError::TokenGenerationFailed(msg) => write!(f, "Token generation failed: {}", msg),
            JwtError::TokenVerificationFailed(msg) => {
                write!(f, "Token verification failed: {}", msg)
            }
            JwtError::TokenExpired => write!(f, "Token expired"),
        }
    }
}

impl std::error::Error for JwtError {}

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: String, // user_id (ObjectId as hex string)
    pub is_owner: bool,
    pub exp: i64, // Expiration time (Unix timestamp)
    pub iat: i64, // Issued at (Unix timestamp)
}

impl JwtClaims {
    /// Create new JWT claims with 7-day expiration
    pub fn new(user_id: ObjectId, is_owner: bool) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            sub: user_id.to_hex(),
            is_owner,
            exp: now + 7 * 24 * 60 * 60, // 7 days from now
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

/// Generate a JWT token for a user
pub fn generate_jwt(user_id: ObjectId, is_owner: bool, secret: &str) -> Result<String, JwtError> {
    let claims = JwtClaims::new(user_id, is_owner);

    let header = Header::new(Algorithm::HS256);
    let encoding_key = EncodingKey::from_secret(secret.as_bytes());

    encode(&header, &claims, &encoding_key)
        .map_err(|e| JwtError::TokenGenerationFailed(e.to_string()))
}

/// Verify a JWT token and extract claims
pub fn verify_jwt(token: &str, secret: &str) -> Result<JwtClaims, JwtError> {
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let token_data = decode::<JwtClaims>(token, &decoding_key, &validation).map_err(|e| {
        if e.to_string().contains("ExpiredSignature") {
            JwtError::TokenExpired
        } else {
            JwtError::TokenVerificationFailed(e.to_string())
        }
    })?;

    // Additional expiration check
    if token_data.claims.is_expired() {
        return Err(JwtError::TokenExpired);
    }

    Ok(token_data.claims)
}
