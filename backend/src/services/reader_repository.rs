//! Reader 数据仓库 - Reader 模型的数据库操作

use mongodb::{bson::doc, Collection, Database};
use bson::oid::ObjectId;
use futures::stream::TryStreamExt;
use crate::models::Reader;

/// Reader 数据仓库，用于数据库操作
pub struct ReaderRepository {
    collection: Collection<Reader>,
}

impl ReaderRepository {
    /// 创建新的 ReaderRepository
    pub fn new(database: &Database) -> Self {
        Self {
            collection: database.collection("readers"),
        }
    }

    /// 在数据库中创建新的 reader
    /// 
    /// # 参数
    /// * `reader` - 要创建的 Reader
    /// 
    /// # 返回
    /// * `Ok(ObjectId)` - 创建的 reader 的 ID
    /// * `Err(mongodb::error::Error)` - 创建失败时
    pub async fn create_reader(&self, reader: &Reader) -> Result<ObjectId, mongodb::error::Error> {
        let result = self.collection.insert_one(reader).await?;
        
        match result.inserted_id.as_object_id() {
            Some(id) => Ok(id),
            None => Err(mongodb::error::Error::custom("无法获取插入的 ID")),
        }
    }

    /// 通过 ID 查找 reader
    /// 
    /// # 参数
    /// * `id` - 要搜索的 ObjectId
    /// 
    /// # 返回
    /// * `Ok(Some(Reader))` - 找到 reader
    /// * `Ok(None)` - 未找到 reader
    /// * `Err(mongodb::error::Error)` - 查询失败时
    pub async fn find_by_id(&self, id: ObjectId) -> Result<Option<Reader>, mongodb::error::Error> {
        self.collection
            .find_one(doc! { "_id": id })
            .await
    }

    /// 检查 readers 集合是否为空（用于首个用户 Owner 检查）
    /// 
    /// # 返回
    /// * `Ok(true)` - 集合为空
    /// * `Ok(false)` - 集合有文档
    /// * `Err(mongodb::error::Error)` - 查询失败时
    pub async fn is_empty(&self) -> Result<bool, mongodb::error::Error> {
        let count = self.collection.count_documents(doc! {}).await?;
        Ok(count == 0)
    }

    /// 获取所有 readers（用于管理目的）
    /// 
    /// # 返回
    /// * `Ok(Vec<Reader>)` - 所有 readers 的列表
    /// * `Err(mongodb::error::Error)` - 查询失败时
    pub async fn get_all(&self) -> Result<Vec<Reader>, mongodb::error::Error> {
        let mut cursor = self.collection
            .find(doc! {})
            .sort(doc! { "createdAt": -1 })
            .await?;

        let mut readers = Vec::new();
        while let Some(reader) = cursor.try_next().await? {
            readers.push(reader);
        }

        Ok(readers)
    }

    /// 更新 reader 信息
    /// 
    /// # 参数
    /// * `reader` - 要更新的 Reader
    /// 
    /// # 返回
    /// * `Ok(())` - 更新成功
    /// * `Err(mongodb::error::Error)` - 更新失败时
    pub async fn update_reader(&self, reader: &Reader) -> Result<(), mongodb::error::Error> {
        self.collection
            .replace_one(doc! { "_id": reader.id }, reader)
            .await?;
        Ok(())
    }

    /// 查找或创建匿名 Reader
    /// 
    /// # 参数
    /// * `name` - 昵称
    /// * `email` - 邮箱
    /// 
    /// # 返回
    /// * `Ok(ObjectId)` - Reader 的 ID
    /// * `Err(mongodb::error::Error)` - 操作失败时
    pub async fn find_or_create_anonymous(&self, name: &str, email: &str) -> Result<ObjectId, mongodb::error::Error> {
        // 先查找是否已存在
        if let Some(reader) = self.collection
            .find_one(doc! {
                "name": name,
                "email": email,
            })
            .await?
        {
            return Ok(reader.id);
        }

        // 不存在则创建新的匿名 Reader
        let handle = Reader::generate_handle(name);
        let avatar = format!("https://cravatar.cn/avatar/{:x}", md5::compute(email.trim().to_lowercase().as_bytes()));
        
        let reader = Reader {
            id: ObjectId::new(),
            email: email.to_string(),
            name: name.to_string(),
            handle,
            image: avatar,
            is_owner: false,
            email_verified: Some(false),
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        };

        self.create_reader(&reader).await
    }

    /// 根据 name 和 email 查找 Reader
    /// 
    /// # 参数
    /// * `name` - 昵称
    /// * `email` - 邮箱
    /// 
    /// # 返回
    /// * `Ok(Some(Reader))` - 找到 Reader
    /// * `Ok(None)` - 未找到 Reader
    /// * `Err(mongodb::error::Error)` - 查询失败时
    pub async fn find_by_name_and_email(&self, name: &str, email: &str) -> Result<Option<Reader>, mongodb::error::Error> {
        self.collection
            .find_one(doc! {
                "name": name,
                "email": email,
            })
            .await
    }

    /// 删除 Reader
    /// 
    /// # 参数
    /// * `id` - Reader 的 ID
    /// 
    /// # 返回
    /// * `Ok(())` - 删除成功
    /// * `Err(mongodb::error::Error)` - 删除失败时
    pub async fn delete_reader(&self, id: ObjectId) -> Result<(), mongodb::error::Error> {
        self.collection
            .delete_one(doc! { "_id": id })
            .await?;
        Ok(())
    }
}
