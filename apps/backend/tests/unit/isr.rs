#![allow(clippy::expect_used)]

use super::sign_revalidation_request;

/// 固定向量用于防止前后端签名字段顺序被单边修改。
#[test]
fn generates_frontend_compatible_signature() {
    let signature = sign_revalidation_request(
        "test-secret",
        "test-salt",
        "posts",
        "/posts/example",
        1_700_000_000,
    )
    .expect("signature should be generated");

    assert_eq!(
        signature,
        "b845d676e876f561a4f82171be865b288735b9d5cb1ac6a280a6fd4a4ded62c1"
    );
}
