//! Owner 守卫 - 验证用户是否为 Owner

use rocket::request::{FromRequest, Outcome, Request};
use rocket::http::Status;
use bson::oid::ObjectId;
use crate::guards::AuthGuard;

/// Owner 守卫 - 确保用户是 Owner
#[derive(Debug, Clone)]
#[allow(unused)]
pub struct OwnerGuard {
    pub user_id: ObjectId,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for OwnerGuard {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // 1. 先通过 AuthGuard 验证
        let auth = match req.guard::<AuthGuard>().await {
            Outcome::Success(auth) => auth,
            Outcome::Error(e) => return Outcome::Error(e),
            Outcome::Forward(f) => return Outcome::Forward(f),
        };

        // 2. 检查是否为 Owner
        if !auth.is_owner {
            log::warn!("用户 {} 尝试访问 Owner 专属 API，但不是 Owner", auth.user_id);
            return Outcome::Error((Status::Forbidden, ()));
        }

        log::debug!("Owner 验证成功: user_id={}", auth.user_id);

        Outcome::Success(OwnerGuard {
            user_id: auth.user_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_owner_guard_creation() {
        let user_id = ObjectId::new();
        let guard = OwnerGuard { user_id };
        assert_eq!(guard.user_id, user_id);
    }

    // 注意：完整的 OwnerGuard 测试需要 Rocket 测试环境
    // 这些测试应该在集成测试中进行
}
