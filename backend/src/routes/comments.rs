use mongodb::bson::{doc, oid::ObjectId, DateTime};
use mongodb::Database;
use rocket::serde::json::Json;
use rocket::{State, http::Status};
use std::str::FromStr;
use md5;

use crate::models::{
    ApiResponse, Comment, CommentListResponse, CommentTree, CreateCommentRequest,
    ResponseStatus, UpdateCommentRequest,
};
use crate::guards::OptionalAuthGuard;
use crate::services::ReaderRepository;

/**
 * 根据邮箱生成 Gravatar/Cravatar 头像 URL
 */
fn generate_avatar_url(email: &str) -> String {
    let trimmed = email.trim().to_lowercase();
    let hash = format!("{:x}", md5::compute(trimmed.as_bytes()));
    format!("https://cravatar.cn/avatar/{}", hash)
}

/**
 * 创建空评论对象（用于错误响应）
 */
fn empty_comment() -> Comment {
    Comment {
        id: None,
        r#ref: ObjectId::new(),
        ref_type: String::new(),
        author: String::new(),
        mail: String::new(),
        text: String::new(),
        state: 0,
        children: None,
        comments_index: 0,
        key: String::new(),
        ip: None,
        agent: None,
        pin: false,
        is_whispers: false,
        source: None,
        avatar: None,
        created: DateTime::now(),
        location: None,
        url: None,
        parent: None,
    }
}

/**
 * GET /api/comments?refId=xxx&refType=posts
 * 获取指定文章/页面/日记的评论列表
 */
#[get("/comments?<ref_id>&<ref_type>")]
pub async fn list_comments(
    db: &State<Database>,
    ref_id: String,
    ref_type: String,
) -> Result<Json<ApiResponse<CommentListResponse>>, Status> {
    let collection = db.collection::<Comment>("comments");
    let reader_repo = ReaderRepository::new(db.inner());

    // 解析 ObjectId
    let ref_oid = match ObjectId::from_str(&ref_id) {
        Ok(oid) => oid,
        Err(_) => {
            return Ok(Json(ApiResponse {
                code: 400,
                status: ResponseStatus::Failed,
                message: "Invalid ref_id".to_string(),
                data: CommentListResponse {
                    comments: vec![],
                    count: 0,
                },
            }));
        }
    };

    // 查询所有评论
    let filter = doc! {
        "ref": ref_oid,
        "refType": &ref_type,
        "state": 1, // 只返回已审核的评论
    };

    let mut cursor = match collection.find(filter).await {
        Ok(cursor) => cursor,
        Err(e) => {
            eprintln!("Failed to query comments: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    let mut all_comments = Vec::new();
    use futures::stream::TryStreamExt;
    while let Some(comment) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error reading comment: {}", e);
        Status::InternalServerError
    })? {
        all_comments.push(comment);
    }

    let count = all_comments.len() as i64;

    // 收集所有唯一的邮箱，用于批量查询 Reader
    let emails: Vec<String> = all_comments
        .iter()
        .map(|c| c.mail.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    // 批量查询所有 Reader，构建邮箱到头像和站长身份的映射
    let mut email_to_avatar = std::collections::HashMap::new();
    let mut email_to_is_owner = std::collections::HashMap::new();
    
    for email in emails {
        // 通过邮箱查找 Reader（假设邮箱是唯一的）
        if let Ok(readers) = reader_repo.get_all().await {
            for reader in readers {
                if reader.email == email {
                    if !reader.image.is_empty() {
                        email_to_avatar.insert(email.clone(), reader.image.clone());
                    }
                    email_to_is_owner.insert(email.clone(), reader.is_owner);
                    break;
                }
            }
        }
    }

    // 构建树形结构，传入头像和站长身份映射
    let tree = build_comment_tree(&all_comments, &email_to_avatar, &email_to_is_owner);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Comments fetched successfully".to_string(),
        data: CommentListResponse {
            comments: tree,
            count,
        },
    }))
}

/**
 * POST /api/comments
 * 创建新评论
 * 
 * 支持两种模式：
 * 1. 匿名评论：必须提供 author 和 mail
 * 2. 登录评论：通过 JWT 获取用户信息，author 和 mail 可选
 */
#[post("/comments", data = "<request>")]
pub async fn create_comment(
    db: &State<Database>,
    auth: OptionalAuthGuard,
    request: Json<CreateCommentRequest>,
) -> Result<Json<ApiResponse<Comment>>, Status> {
    let collection = db.collection::<Comment>("comments");
    let reader_repo = ReaderRepository::new(db.inner());

    // 确定作者信息和头像
    let (author, mail, avatar_url, source, _reader_id) = if let Some(user_id) = auth.user_id {
        // 已登录用户：从 Reader 获取信息
        match reader_repo.find_by_id(user_id).await {
            Ok(Some(reader)) => {
                let author = request.author.clone().unwrap_or(reader.name.clone());
                let mail = request.mail.clone().unwrap_or(reader.email.clone());
                // 优先使用 Reader 的头像，否则根据邮箱生成
                let avatar = if !reader.image.is_empty() {
                    reader.image.clone()
                } else {
                    generate_avatar_url(&mail)
                };
                // 标记来源为 OAuth 登录
                let source = Some("oauth".to_string());
                (author, mail, avatar, source, Some(user_id))
            }
            Ok(None) => {
                log::warn!("用户 {} 不存在", user_id);
                return Ok(Json(ApiResponse {
                    code: 401,
                    status: ResponseStatus::Failed,
                    message: "用户不存在".to_string(),
                    data: empty_comment(),
                }));
            }
            Err(e) => {
                log::error!("查询用户失败: {}", e);
                return Err(Status::InternalServerError);
            }
        }
    } else {
        // 未登录用户：必须提供 author 和 mail，并创建/查找 Reader
        let author = match &request.author {
            Some(a) if !a.trim().is_empty() => a.clone(),
            _ => {
                return Ok(Json(ApiResponse {
                    code: 400,
                    status: ResponseStatus::Failed,
                    message: "未登录用户必须提供昵称".to_string(),
                    data: empty_comment(),
                }));
            }
        };
        let mail = match &request.mail {
            Some(m) if !m.trim().is_empty() => m.clone(),
            _ => {
                return Ok(Json(ApiResponse {
                    code: 400,
                    status: ResponseStatus::Failed,
                    message: "未登录用户必须提供邮箱".to_string(),
                    data: empty_comment(),
                }));
            }
        };
        
        // 查找或创建匿名 Reader
        let reader_id = match reader_repo.find_or_create_anonymous(&author, &mail).await {
            Ok(id) => id,
            Err(e) => {
                log::error!("创建匿名 Reader 失败: {}", e);
                return Err(Status::InternalServerError);
            }
        };
        
        let avatar = generate_avatar_url(&mail);
        (author, mail, avatar, None, Some(reader_id))
    };

    // 验证必填字段
    if request.text.trim().is_empty() {
        return Ok(Json(ApiResponse {
            code: 400,
            status: ResponseStatus::Failed,
            message: "评论内容不能为空".to_string(),
            data: empty_comment(),
        }));
    }

    // 解析 ref ObjectId
    let ref_oid = match ObjectId::from_str(&request.r#ref) {
        Ok(oid) => oid,
        Err(_) => {
            return Ok(Json(ApiResponse {
                code: 400,
                status: ResponseStatus::Failed,
                message: "Invalid ref id".to_string(),
                data: empty_comment(),
            }));
        }
    };

    // 解析 parent ObjectId（如果有）
    let parent_oid = if let Some(parent_str) = &request.parent {
        match ObjectId::from_str(parent_str) {
            Ok(oid) => Some(oid),
            Err(_) => None,
        }
    } else {
        None
    };

    // 生成 key
    let key = if let Some(parent_id) = parent_oid {
        // 回复评论：获取父评论的 key，然后追加子评论序号
        let parent_comment = collection
            .find_one(doc! { "_id": parent_id })
            .await
            .ok()
            .flatten();

        if let Some(parent) = parent_comment {
            // 统计该父评论下已有的直接子评论数量
            let sibling_count = collection
                .count_documents(doc! { "parent": parent_id })
                .await
                .unwrap_or(0);
            // 父评论 key 如 "#1" 或 "#1#2"，子评论 key 为 "#1#1" 或 "#1#2#1"
            format!("{}#{}", parent.key, sibling_count + 1)
        } else {
            // 父评论不存在，降级为根评论处理
            let root_count = collection
                .count_documents(doc! { "ref": ref_oid, "refType": &request.ref_type, "parent": null })
                .await
                .unwrap_or(0);
            format!("#{}", root_count + 1)
        }
    } else {
        // 根评论：统计该文章下的根评论数量
        let root_count = collection
            .count_documents(doc! { "ref": ref_oid, "refType": &request.ref_type, "parent": null })
            .await
            .unwrap_or(0);
        format!("#{}", root_count + 1)
    };

    // 获取当前评论索引（所有评论的总数）
    let count = collection
        .count_documents(doc! { "ref": ref_oid, "refType": &request.ref_type })
        .await
        .unwrap_or(0);

    // 创建评论
    let comment = Comment {
        id: None,
        r#ref: ref_oid,
        ref_type: request.ref_type.clone(),
        author,
        mail,
        text: request.text.clone(),
        state: 1, // 默认审核通过
        children: Some(vec![]),
        comments_index: (count + 1) as i32,
        key,
        ip: None,
        agent: None,
        pin: false,
        is_whispers: false,
        source,
        avatar: Some(avatar_url),
        created: DateTime::now(),
        location: None,
        url: request.url.clone(),
        parent: parent_oid,
    };

    match collection.insert_one(&comment).await {
        Ok(result) => {
            let mut created_comment = comment;
            created_comment.id = Some(result.inserted_id.as_object_id().unwrap());

            // 如果是回复，更新父评论的 children 字段
            if let Some(parent_id) = parent_oid {
                let _ = collection
                    .update_one(
                        doc! { "_id": parent_id },
                        doc! { "$push": { "children": created_comment.id.unwrap() } },
                    )
                    .await;
            }

            Ok(Json(ApiResponse {
                code: 201,
                status: ResponseStatus::Success,
                message: "Comment created successfully".to_string(),
                data: created_comment,
            }))
        }
        Err(e) => {
            eprintln!("Failed to create comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}

/**
 * PUT /api/comments/<id>
 * 更新评论
 */
#[put("/comments/<id>", data = "<request>")]
pub async fn update_comment(
    db: &State<Database>,
    id: String,
    request: Json<UpdateCommentRequest>,
) -> Result<Json<ApiResponse<Comment>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    let update = doc! {
        "$set": {
            "text": &request.text,
        }
    };

    match collection.update_one(doc! { "_id": oid }, update).await {
        Ok(_) => {
            // 获取更新后的评论
            match collection.find_one(doc! { "_id": oid }).await {
                Ok(Some(comment)) => Ok(Json(ApiResponse {
                    code: 200,
                    status: ResponseStatus::Success,
                    message: "Comment updated successfully".to_string(),
                    data: comment,
                })),
                _ => Err(Status::InternalServerError),
            }
        }
        Err(e) => {
            eprintln!("Failed to update comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}

/**
 * DELETE /api/comments/<id>
 * 删除评论
 */
#[delete("/comments/<id>")]
pub async fn delete_comment(
    db: &State<Database>,
    id: String,
) -> Result<Json<ApiResponse<()>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    match collection.delete_one(doc! { "_id": oid }).await {
        Ok(_) => Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "Comment deleted successfully".to_string(),
            data: (),
        })),
        Err(e) => {
            eprintln!("Failed to delete comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}

/**
 * 构建评论树形结构
 * 
 * @param comments 所有评论
 * @param email_to_avatar 邮箱到最新头像的映射
 * @param email_to_is_owner 邮箱到站长身份的映射
 */
fn build_comment_tree(
    comments: &[Comment],
    email_to_avatar: &std::collections::HashMap<String, String>,
    email_to_is_owner: &std::collections::HashMap<String, bool>,
) -> Vec<CommentTree> {
    use std::collections::HashMap;

    // 创建 ID 到评论的映射
    let mut comment_map: HashMap<String, CommentTree> = HashMap::new();
    let mut root_ids: Vec<String> = Vec::new();

    // 第一遍：创建所有评论节点，并记录根评论 ID
    for comment in comments {
        let id_str = comment.id.as_ref().unwrap().to_hex();
        
        // 优先使用 Reader 的最新头像，否则使用评论保存的头像，最后根据邮箱生成
        let avatar_url = email_to_avatar
            .get(&comment.mail)
            .cloned()
            .or_else(|| comment.avatar.clone())
            .unwrap_or_else(|| generate_avatar_url(&comment.mail));
        
        // 判断是否为站长
        let is_admin = email_to_is_owner
            .get(&comment.mail)
            .copied()
            .filter(|&is_owner| is_owner);
        
        let tree_node = CommentTree {
            id: id_str.clone(),
            r#ref: comment.r#ref.to_hex(),
            ref_type: comment.ref_type.clone(),
            author: comment.author.clone(),
            text: comment.text.clone(),
            state: comment.state,
            children: vec![],
            comments_index: comment.comments_index,
            key: comment.key.clone(),
            pin: comment.pin,
            is_whispers: comment.is_whispers,
            is_admin,
            source: comment.source.clone(),
            avatar: Some(avatar_url),
            created: comment.created.to_chrono().to_rfc3339(),
            location: comment.location.clone(),
            url: comment.url.clone(),
            parent: comment.parent.as_ref().map(|p| p.to_hex()),
        };

        // 记录根评论 ID
        if comment.parent.is_none() {
            root_ids.push(id_str.clone());
        }

        comment_map.insert(id_str, tree_node);
    }

    // 递归构建子树
    fn build_children(
        parent_id: &str,
        comment_map: &HashMap<String, CommentTree>,
        comments: &[Comment],
    ) -> Vec<CommentTree> {
        let mut children = Vec::new();
        
        for comment in comments {
            if let Some(parent_oid) = &comment.parent {
                if parent_oid.to_hex() == parent_id {
                    let child_id = comment.id.as_ref().unwrap().to_hex();
                    if let Some(mut child_node) = comment_map.get(&child_id).cloned() {
                        // 递归构建子评论的子评论
                        child_node.children = build_children(&child_id, comment_map, comments);
                        children.push(child_node);
                    }
                }
            }
        }
        
        // 按创建时间排序
        children.sort_by(|a, b| a.created.cmp(&b.created));
        children
    }

    // 构建根评论及其子树
    let mut root_comments = Vec::new();
    for root_id in root_ids {
        if let Some(mut root_node) = comment_map.get(&root_id).cloned() {
            root_node.children = build_children(&root_id, &comment_map, comments);
            root_comments.push(root_node);
        }
    }

    // 按创建时间排序
    root_comments.sort_by(|a, b| a.created.cmp(&b.created));

    root_comments
}
