//! Account 数据仓库 - Account 模型的数据库操作

use mongodb::{bson::doc, Collection, Database};
use bson::oid::ObjectId;
use futures::stream::TryStreamExt;
use crate::models::Account;

/// Account 数据仓库，用于数据库操作
pub struct AccountRepository {
    collection: Collection<Account>,
}

impl AccountRepository {
    /// 创建新的 AccountRepository
    pub fn new(database: &Database) -> Self {
        Self {
            collection: database.collection("accounts"),
        }
    }

    /// 在数据库中创建新的 account
    /// 
    /// # 参数
    /// * `account` - 要创建的 Account
    /// 
    /// # 返回
    /// * `Ok(ObjectId)` - 创建的 account 的 ID
    /// * `Err(mongodb::error::Error)` - 创建失败时
    pub async fn create_account(&self, account: &Account) -> Result<ObjectId, mongodb::error::Error> {
        let result = self.collection.insert_one(account).await?;
        
        match result.inserted_id.as_object_id() {
            Some(id) => Ok(id),
            None => Err(mongodb::error::Error::custom("无法获取插入的 ID")),
        }
    }

    /// 通过提供商和账号 ID 查找 account
    /// 
    /// # 参数
    /// * `provider` - OAuth 提供商（"github" 或 "qq"）
    /// * `account_id` - 提供商特定的账号 ID
    /// 
    /// # 返回
    /// * `Ok(Some(Account))` - 找到 account
    /// * `Ok(None)` - 未找到 account
    /// * `Err(mongodb::error::Error)` - 查询失败时
    pub async fn find_by_provider_and_account_id(
        &self,
        provider: &str,
        account_id: &str,
    ) -> Result<Option<Account>, mongodb::error::Error> {
        self.collection
            .find_one(doc! {
                "provider": provider,
                "accountId": account_id
            })
            .await
    }

    /// 查找用户的所有 accounts
    /// 
    /// # 参数
    /// * `user_id` - 用户的 ObjectId
    /// 
    /// # 返回
    /// * `Ok(Vec<Account>)` - 用户的 accounts 列表
    /// * `Err(mongodb::error::Error)` - 查询失败时
    pub async fn find_by_user_id(&self, user_id: ObjectId) -> Result<Vec<Account>, mongodb::error::Error> {
        let mut cursor = self.collection
            .find(doc! { "userId": user_id })
            .sort(doc! { "createdAt": -1 })
            .await?;

        let mut accounts = Vec::new();
        while let Some(account) = cursor.try_next().await? {
            accounts.push(account);
        }

        Ok(accounts)
    }

    /// 更新 account 的 userId
    /// 
    /// # 参数
    /// * `account_id` - Account 的 ID
    /// * `new_user_id` - 新的 userId
    /// 
    /// # 返回
    /// * `Ok(())` - 更新成功
    /// * `Err(mongodb::error::Error)` - 更新失败时
    pub async fn update_user_id(&self, account_id: ObjectId, new_user_id: ObjectId) -> Result<(), mongodb::error::Error> {
        self.collection
            .update_one(
                doc! { "_id": account_id },
                doc! { "$set": { "userId": new_user_id } }
            )
            .await?;
        Ok(())
    }
}