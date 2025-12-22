use mongodb::Database;
use bson::oid::ObjectId;
use crate::models::Account;
use crate::services::{ReaderRepository, AccountRepository};
use crate::utils::jwt::generate_jwt;

pub struct OAuthUserPayload {
    pub provider: String,
    pub provider_id: String,
    pub name: String,
    pub email: Option<String>,
    pub avatar: Option<String>,
    pub handle: Option<String>,
    pub access_token: String,
    pub scope: Option<String>,
}

pub struct IdentityService {
    db: Database,
    jwt_secret: String,
}

impl IdentityService {
    pub fn new(db: &Database, jwt_secret: String) -> Self {
        Self {
            db: db.clone(),
            jwt_secret,
        }
    }

    /// 处理通用的 OAuth 登录流逻辑
    pub async fn process_oauth_login(&self, payload: OAuthUserPayload) -> Result<(ObjectId, bool, bool), String> {
        let reader_repo = ReaderRepository::new(&self.db);
        let account_repo = AccountRepository::new(&self.db);

        // 1. 查找现有账号
        let existing_acc = account_repo.find_by_provider_and_account_id(&payload.provider, &payload.provider_id)
            .await.map_err(|e| e.to_string())?;

        if let Some(acc) = existing_acc {
            let reader = reader_repo.find_by_id(acc.user_id).await.map_err(|e| e.to_string())?
                .ok_or_else(|| "账户数据不一致".to_string())?;
            return Ok((reader.id, reader.is_owner, false));
        }

        // 2. 新用户：尝试通过邮箱自动匹配
        if let Some(ref email) = payload.email {
            if let Some(matched_reader) = reader_repo.find_by_email(email).await.map_err(|e| e.to_string())? {
                // 自动绑定到已有 Reader
                self.create_account_record(matched_reader.id, &payload).await?;
                return Ok((matched_reader.id, matched_reader.is_owner, false));
            }
        }

        // 3. 彻底的新用户：检查是否是系统第一个用户
        let is_first = reader_repo.is_empty().await.unwrap_or(false);
        let temp_id = ObjectId::new();
        
        self.create_account_record(temp_id, &payload).await?;
        
        Ok((temp_id, is_first, true))
    }

    /// 辅助函数：内部创建 Repository，避开生命周期烦恼
    async fn create_account_record(&self, user_id: ObjectId, payload: &OAuthUserPayload) -> Result<(), String> {
        let account_repo = AccountRepository::new(&self.db);

        let mut account = if payload.provider == "github" {
            let github_id = payload.provider_id.parse::<u64>().map_err(|_| "无效的 GitHub ID")?;
            Account::new_github_with_info(
                user_id,
                github_id,
                payload.access_token.clone(),
                payload.scope.clone(),
                payload.name.clone(),
                payload.email.clone(),
                payload.avatar.clone().unwrap_or_default(),
                payload.handle.clone().unwrap_or_else(|| "user".to_string()),
            )
        } else {
            Account::new_qq_with_info(
                user_id,
                payload.provider_id.clone(),
                payload.access_token.clone(),
                payload.name.clone(),
                payload.avatar.clone().unwrap_or_default(),
            )
        };

        // 如果是 QQ 或其他，确保 provider 字段正确
        if payload.provider != "github" {
            account.provider = payload.provider.clone();
        }

        account_repo.create_account(&account).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn merge_identities(&self, from_id: ObjectId, to_id: ObjectId) -> Result<(), String> {
        let account_repo = AccountRepository::new(&self.db);
        let accounts = account_repo.find_by_user_id(from_id).await.map_err(|e| e.to_string())?;
        for acc in accounts {
            account_repo.update_user_id(acc.id, to_id).await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn issue_token(&self, user_id: ObjectId, is_owner: bool) -> Result<String, String> {
        generate_jwt(user_id, is_owner, &self.jwt_secret).map_err(|e| format!("{:?}", e))
    }
}