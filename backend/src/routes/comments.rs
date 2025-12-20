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

/**
 * 根据邮箱生成 Gravatar/Cravatar 头像 URL
 */
fn generate_avatar_url(email: &str) -> String {
    let trimmed = email.trim().to_lowercase();
    let hash = format!("{:x}", md5::compute(trimmed.as_bytes()));
    format!("https://cravatar.cn/avatar/{}", hash)
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

    // 构建树形结构
    let tree = build_comment_tree(&all_comments);

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
 */
#[post("/comments", data = "<request>")]
pub async fn create_comment(
    db: &State<Database>,
    request: Json<CreateCommentRequest>,
) -> Result<Json<ApiResponse<Comment>>, Status> {
    let collection = db.collection::<Comment>("comments");

    // 验证必填字段
    if request.text.trim().is_empty() {
        return Ok(Json(ApiResponse {
            code: 400,
            status: ResponseStatus::Failed,
            message: "Comment text cannot be empty".to_string(),
            data: Comment {
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
            },
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
                data: Comment {
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
                },
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

    // 生成头像 URL
    let avatar_url = generate_avatar_url(&request.mail);

    // 创建评论
    let comment = Comment {
        id: None,
        r#ref: ref_oid,
        ref_type: request.ref_type.clone(),
        author: request.author.clone(),
        mail: request.mail.clone(),
        text: request.text.clone(),
        state: 1, // 默认审核通过
        children: Some(vec![]),
        comments_index: (count + 1) as i32,
        key,
        ip: None,
        agent: None,
        pin: false,
        is_whispers: false,
        source: None,
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
 */
fn build_comment_tree(comments: &[Comment]) -> Vec<CommentTree> {
    use std::collections::HashMap;

    // 创建 ID 到评论的映射
    let mut comment_map: HashMap<String, CommentTree> = HashMap::new();
    let mut root_ids: Vec<String> = Vec::new();

    // 第一遍：创建所有评论节点，并记录根评论 ID
    for comment in comments {
        let id_str = comment.id.as_ref().unwrap().to_hex();
        
        // 如果没有头像，根据邮箱生成
        let avatar_url = comment.avatar.clone().unwrap_or_else(|| {
            generate_avatar_url(&comment.mail)
        });
        
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
