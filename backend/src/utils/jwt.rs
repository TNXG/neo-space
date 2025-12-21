//! JWT token generation and verification utilities

use bson::oid::ObjectId;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use crate::models::JwtClaims;

/// JWT error types
#[derive(Debug)]
pub enum JwtError {
    TokenGenerationFailed(String),
    TokenVerificationFailed(String),
    #[allow(unused)]
    InvalidToken,
    TokenExpired,
}

impl std::fmt::Display for JwtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JwtError::TokenGenerationFailed(msg) => write!(f, "Token generation failed: {}", msg),
            JwtError::TokenVerificationFailed(msg) => write!(f, "Token verification failed: {}", msg),
            JwtError::InvalidToken => write!(f, "Invalid token"),
            JwtError::TokenExpired => write!(f, "Token expired"),
        }
    }
}

impl std::error::Error for JwtError {}

/// Generate a JWT token for a user
/// 
/// # Arguments
/// * `user_id` - The user's ObjectId
/// * `is_owner` - Whether the user is an owner
/// * `secret` - The JWT secret key
/// 
/// # Returns
/// * `Ok(String)` - The generated JWT token
/// * `Err(JwtError)` - If token generation fails
pub fn generate_jwt(user_id: ObjectId, is_owner: bool, secret: &str) -> Result<String, JwtError> {
    let claims = JwtClaims::new(user_id, is_owner);
    
    let header = Header::new(Algorithm::HS256);
    let encoding_key = EncodingKey::from_secret(secret.as_bytes());
    
    encode(&header, &claims, &encoding_key)
        .map_err(|e| JwtError::TokenGenerationFailed(e.to_string()))
}

/// Verify a JWT token and extract claims
/// 
/// # Arguments
/// * `token` - The JWT token string
/// * `secret` - The JWT secret key
/// 
/// # Returns
/// * `Ok(JwtClaims)` - The extracted claims if token is valid
/// * `Err(JwtError)` - If token is invalid or expired
pub fn verify_jwt(token: &str, secret: &str) -> Result<JwtClaims, JwtError> {
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    
    let token_data = decode::<JwtClaims>(token, &decoding_key, &validation)
        .map_err(|e| {
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