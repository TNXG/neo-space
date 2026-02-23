use crate::models::Account;
use crate::repositories::{AccountRepository, ReaderRepository};
use crate::utils::jwt::generate_jwt;
use bson::oid::ObjectId;
use mongodb::Database;

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
    pub async fn process_oauth_login(
        &self,
        payload: OAuthUserPayload,
    ) -> Result<(ObjectId, bool, bool), String> {
        let reader_repo = ReaderRepository::new(&self.db);
        let account_repo = AccountRepository::new(&self.db);

        log::info!(
            "[OAuth] 开始处理登录: provider={}, provider_id={}, name={}, email={:?}",
            payload.provider,
            payload.provider_id,
            payload.name,
            payload.email
        );

        // 1. 查找现有账号
        let existing_acc = account_repo
            .find_by_provider_and_account_id(&payload.provider, &payload.provider_id)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(acc) = existing_acc {
            log::info!(
                "[OAuth] 找到现有账号: account_id={}, user_id={}",
                acc.id,
                acc.user_id
            );
            let reader = reader_repo
                .find_by_id(acc.user_id)
                .await
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "账户数据不一致".to_string())?;
            log::info!("[OAuth] 返回现有用户: is_new_user=false");
            return Ok((reader.id, reader.is_owner, false));
        }

        log::info!("[OAuth] 未找到现有账号，尝试邮箱匹配");

        // 2. 新用户：尝试通过邮箱自动匹配
        if let Some(ref email) = payload.email {
            if let Some(matched_reader) = reader_repo
                .find_by_email(email)
                .await
                .map_err(|e| e.to_string())?
            {
                log::info!(
                    "[OAuth] 通过邮箱匹配到现有用户: email={}, user_id={}",
                    email,
                    matched_reader.id
                );
                // 自动绑定到已有 Reader
                self.create_account_record(matched_reader.id, &payload)
                    .await?;
                log::info!("[OAuth] 自动绑定完成: is_new_user=false");
                return Ok((matched_reader.id, matched_reader.is_owner, false));
            }
        }

        log::info!("[OAuth] 创建新用户");

        // 3. 彻底的新用户：检查是否是系统第一个用户
        let is_first = reader_repo.is_empty().await.unwrap_or(false);
        let temp_id = ObjectId::new();

        self.create_account_record(temp_id, &payload).await?;

        log::info!(
            "[OAuth] 新用户创建完成: temp_id={temp_id}, is_first={is_first}, is_new_user=true"
        );

        Ok((temp_id, is_first, true))
    }

    /// 辅助函数：内部创建 Repository，避开生命周期烦恼
    async fn create_account_record(
        &self,
        user_id: ObjectId,
        payload: &OAuthUserPayload,
    ) -> Result<(), String> {
        let account_repo = AccountRepository::new(&self.db);

        let mut account = if payload.provider == "github" {
            let github_id = payload
                .provider_id
                .parse::<u64>()
                .map_err(|_| "无效的 GitHub ID")?;
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

        account_repo
            .create_account(&account)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn merge_identities(&self, from_id: ObjectId, to_id: ObjectId) -> Result<(), String> {
        let account_repo = AccountRepository::new(&self.db);
        let accounts = account_repo
            .find_by_user_id(from_id)
            .await
            .map_err(|e| e.to_string())?;
        for acc in accounts {
            account_repo
                .update_user_id(acc.id, to_id)
                .await
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn issue_token(&self, user_id: ObjectId, is_owner: bool) -> Result<String, String> {
        generate_jwt(user_id, is_owner, &self.jwt_secret).map_err(|e| format!("{e:?}"))
    }
}
