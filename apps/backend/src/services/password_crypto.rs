//! Per-process browser password transport; stored credentials remain bcrypt hashes.

use aws_lc_rs::{
    encoding::{AsDer, PublicKeyX509Der},
    rsa::{KeySize, OAEP_SHA256_MGF1SHA256, OaepPrivateDecryptingKey, PrivateDecryptingKey},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::Serialize;
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use crate::error::{AppError, AppResult};

const KEY_BITS: usize = 4096;
const CIPHERTEXT_BYTES: usize = KEY_BITS / 8;
const CIPHERTEXT_BASE64_BYTES: usize = CIPHERTEXT_BYTES.div_ceil(3) * 4;

/// The private key is never serialized, cloned, or exposed outside this service.
pub struct PasswordCrypto {
    private_key: OaepPrivateDecryptingKey,
    public_key_pem: String,
    key_id: String,
}

#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PasswordKeyResponse {
    pub key_id: String,
    /// SPKI PEM suitable for WebCrypto importKey("spki", ..., RSA-OAEP/SHA-256).
    pub public_key: String,
    #[schema(example = "RSA-OAEP-256")]
    pub algorithm: &'static str,
}

impl PasswordCrypto {
    /// Generate once during startup; any failure prevents the server from starting.
    pub fn new() -> std::io::Result<Self> {
        let private_key =
            PrivateDecryptingKey::generate(KeySize::Rsa4096).map_err(std::io::Error::other)?;
        let public_key_der = AsDer::<PublicKeyX509Der>::as_der(&private_key.public_key())
            .map_err(std::io::Error::other)?;
        let encoded = STANDARD.encode(public_key_der.as_ref());
        let mut public_key_pem = String::from("-----BEGIN PUBLIC KEY-----\n");
        for line in encoded.as_bytes().chunks(64) {
            public_key_pem.push_str(std::str::from_utf8(line).map_err(std::io::Error::other)?);
            public_key_pem.push('\n');
        }
        public_key_pem.push_str("-----END PUBLIC KEY-----\n");
        let private_key =
            OaepPrivateDecryptingKey::new(private_key).map_err(std::io::Error::other)?;
        let key_id = hex::encode(Sha256::digest(public_key_pem.as_bytes()));
        Ok(Self {
            private_key,
            public_key_pem,
            key_id,
        })
    }

    pub fn public_key_response(&self) -> PasswordKeyResponse {
        PasswordKeyResponse {
            key_id: self.key_id.clone(),
            public_key: self.public_key_pem.clone(),
            algorithm: "RSA-OAEP-256",
        }
    }

    /// Reject stale keys and non-standard/wrong-sized base64 before expensive work.
    pub fn decode_ciphertext(&self, ciphertext: &str, key_id: &str) -> AppResult<Vec<u8>> {
        if key_id != self.key_id {
            return Err(AppError::BadRequest(
                "Password encryption key has rotated; refresh and try again".to_string(),
            ));
        }
        if ciphertext.len() != CIPHERTEXT_BASE64_BYTES {
            return Err(invalid_ciphertext());
        }
        let encrypted = STANDARD
            .decode(ciphertext)
            .map_err(|_| invalid_ciphertext())?;
        if encrypted.len() != CIPHERTEXT_BYTES {
            return Err(invalid_ciphertext());
        }
        Ok(encrypted)
    }

    /// Run only on a blocking worker: AWS-LC OAEP decryption, bcrypt, then erase bytes.
    pub fn verify_password(&self, ciphertext: &[u8], stored_hash: &str) -> AppResult<bool> {
        let mut plaintext = Zeroizing::new(vec![0u8; self.private_key.min_output_size()]);
        let password = self
            .private_key
            .decrypt(&OAEP_SHA256_MGF1SHA256, ciphertext, &mut plaintext, None)
            .map_err(|_| invalid_ciphertext())?;
        std::str::from_utf8(password).map_err(|_| invalid_ciphertext())?;
        Ok(bcrypt::verify(password, stored_hash).unwrap_or(false))
    }
}

fn invalid_ciphertext() -> AppError {
    AppError::BadRequest("Invalid encrypted password; refresh and try again".to_string())
}
