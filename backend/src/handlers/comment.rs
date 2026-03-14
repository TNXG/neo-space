//! Comment handlers

use crate::{
    app::SharedState,
    auth::extractors::OptionalAuth,
    error::{AppError, AppJson, AppQuery, AppResult},
    external::ip_location::get_ip_location,
    models::{
        comment::{Comment, CommentListResponse, CommentState, CommentTree, CreateCommentRequest},
        common::{ApiResponse, ResponseStatus},
        user::Reader,
    },
    services::{
        comment::CommentService,
        helpers::{extract_client_ip, verify_turnstile},
        notification::{CommentNotification, NotificationService},
        spam::SpamDetector,
    },
};
use axum::http::HeaderMap;
use axum::{Json, extract::State};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::Deserialize;

/// Query parameters for listing comments
#[derive(Debug, Deserialize)]
pub struct ListCommentsQuery {
    /// Reference ID (post or note ID) - also accepts `ref_id` for backward compatibility
    #[serde(alias = "ref_id")]
    pub r#ref: Option<String>,
    /// Reference type ("post" or "note")
    pub ref_type: Option<String>,
}

/// List comments with tree structure
pub async fn list_comments(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<ListCommentsQuery>,
    auth: OptionalAuth,
) -> AppResult<Json<ApiResponse<CommentListResponse>>> {
    let r#ref = query
        .r#ref
        .ok_or_else(|| AppError::BadRequest("Missing ref parameter".to_string()))?;
    let ref_type = query
        .ref_type
        .ok_or_else(|| AppError::BadRequest("Missing ref_type parameter".to_string()))?;

    let comment = CommentService::new(state.db.clone());

    // Build visibility filter based on user role
    let filter = comment
        .build_visibility_filter(&r#ref, &ref_type, &auth)
        .await;

    let collection = state.db.collection::<Comment>("comments");

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": 1 })
        .build();

    let mut cursor = collection
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Database(format!("Failed to find comments: {}", e)))?;

    let mut comments = Vec::new();
    while let Some(comment) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(format!("Failed to deserialize comment: {}", e)))?
    {
        comments.push(comment);
    }

    // Extract unique emails for Reader mapping
    let emails: Vec<String> = comments.iter().map(|c| c.mail.clone()).collect();
    let (email_to_avatar, email_to_is_owner) = comment.build_reader_mappings(emails).await;

    // Build comment tree
    let comment_trees = comment.build_comment_tree(&comments, &email_to_avatar, &email_to_is_owner);

    // Count all comments (not just root trees) to match Rocket behavior
    let count = comments.len() as i64;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: CommentListResponse {
            comments: comment_trees,
            count,
        },
    }))
}

/// Create a new comment
pub async fn create_comment(
    State(state): State<SharedState>,
    auth: OptionalAuth,
    headers: HeaderMap,
    AppJson(payload): AppJson<CreateCommentRequest>,
) -> AppResult<Json<ApiResponse<CommentTree>>> {
    // Convert ref string to Bson (ObjectId if valid, otherwise String)
    let ref_bson = if let Ok(oid) = ObjectId::parse_str(&payload.r#ref) {
        bson::Bson::ObjectId(oid)
    } else {
        bson::Bson::String(payload.r#ref.clone())
    };

    // Validate ref_type
    if !["post", "note"].contains(&payload.ref_type.as_str()) {
        return Err(AppError::BadRequest(
            "Invalid ref_type, must be 'post' or 'note'".to_string(),
        ));
    }

    // Input length validation
    if payload.text.is_empty() {
        return Err(AppError::BadRequest(
            "Comment text cannot be empty".to_string(),
        ));
    }
    if payload.text.len() > 5000 {
        return Err(AppError::BadRequest(
            "Comment text cannot exceed 5000 characters".to_string(),
        ));
    }
    if let Some(ref author) = payload.author
        && author.len() > 100 {
            return Err(AppError::BadRequest(
                "Author name cannot exceed 100 characters".to_string(),
            ));
        }
    if let Some(ref mail) = payload.mail
        && mail.len() > 254 {
            return Err(AppError::BadRequest(
                "Email address is too long".to_string(),
            ));
        }
    if let Some(ref url) = payload.url
        && url.len() > 500 {
            return Err(AppError::BadRequest("URL is too long".to_string()));
        }

    let comment = CommentService::new(state.db.clone());

    // Extract client IP from headers
    let client_ip = extract_client_ip(&headers);

    // Get IP location asynchronously
    let location = if let Some(ref ip) = client_ip {
        get_ip_location(ip, &state.http_client).await
    } else {
        None
    };

    // Get user info from auth if available
    let (author, mail, is_owner, avatar_url, source) = if let Some(user_id) = auth.user_id {
        let collection = state.db.collection::<Reader>("readers");
        let reader = collection
            .find_one(doc! { "_id": user_id })
            .await
            .map_err(|e| AppError::Database(format!("Failed to find user: {}", e)))?
            .ok_or(AppError::NotFound("User not found".to_string()))?;

        let avatar = if reader.image.is_empty() {
            CommentService::generate_avatar_url(&reader.email)
        } else {
            reader.image.clone()
        };

        // Determine OAuth source from accounts collection
        let source = CommentService::determine_oauth_source(&state.db, user_id).await;

        (
            reader.name,
            reader.email,
            reader.is_owner,
            avatar,
            Some(source),
        )
    } else {
        // Anonymous comment
        let author = payload.author.clone().ok_or_else(|| {
            AppError::BadRequest("Author is required for anonymous comments".to_string())
        })?;
        let mail = payload.mail.clone().ok_or_else(|| {
            AppError::BadRequest("Email is required for anonymous comments".to_string())
        })?;

        if author.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Author name cannot be empty".to_string(),
            ));
        }
        if mail.trim().is_empty() {
            return Err(AppError::BadRequest("Email cannot be empty".to_string()));
        }

        // Verify Turnstile token for anonymous users
        if let Some(ref token) = payload.turnstile_token {
            let secret = &state.config.turnstile_secret;
            // Only verify if secret is configured (not the placeholder)
            if !secret.is_empty() && secret != "THISISTURNSTILEKEY" {
                verify_turnstile(token, secret, &state.http_client)
                    .await
                    .map_err(|_| AppError::BadRequest("CAPTCHA verification failed".to_string()))?;
            }
        } else if !state.config.turnstile_secret.is_empty()
            && state.config.turnstile_secret != "THISISTURNSTILEKEY"
        {
            return Err(AppError::BadRequest(
                "CAPTCHA token required for anonymous comments".to_string(),
            ));
        }

        // Find or create anonymous Reader (matches Rocket's find_or_create_anonymous)
        CommentService::find_or_create_anonymous_reader(&state.db, &author, &mail).await?;

        let avatar = CommentService::generate_avatar_url(&mail);

        (author, mail, false, avatar, None)
    };

    // Parse parent ID if provided
    let parent_oid = if let Some(parent_str) = payload.parent {
        Some(
            ObjectId::parse_str(&parent_str)
                .map_err(|_| AppError::BadRequest("Invalid parent ID format".to_string()))?,
        )
    } else {
        None
    };

    // Get parent author if this is a reply (for notification)
    let parent_author = if let Some(parent_id) = parent_oid {
        let parent_collection = state.db.collection::<Comment>("comments");
        parent_collection
            .find_one(doc! { "_id": parent_id })
            .await
            .map_err(|e| AppError::Database(format!("Failed to find parent comment: {}", e)))?
            .map(|c| c.author)
    } else {
        None
    };

    // Clone UA info for notification before it's moved into comment
    let ua_string = payload
        .ua
        .as_ref()
        .map(|ua| format!("{} {}", ua.browser, ua.os));

    // Generate comment key
    let key = comment
        .generate_comment_key(&ref_bson, &payload.ref_type, parent_oid)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to generate comment key: {}", e)))?;

    // Get comment index
    let comments_index = comment
        .get_comment_index(&ref_bson, &payload.ref_type)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to get comment index: {}", e)))?;

    // Determine comment state based on user role
    let state_value = if is_owner {
        CommentState::READ // Admin comments are automatically approved
    } else {
        CommentState::UNREAD // Normal users need approval
    };

    let new_comment = Comment {
        id: None,
        r#ref: ref_bson,
        ref_type: payload.ref_type,
        author,
        mail,
        text: payload.text,
        state: state_value,
        children: Some(vec![]),
        comments_index,
        key,
        ip: client_ip,
        agent: None,
        pin: false,
        is_whispers: false,
        source,
        avatar: Some(avatar_url),
        created: bson::DateTime::now(),
        location,
        url: payload.url,
        parent: parent_oid,
        ua: payload.ua,
    };

    let collection = state.db.collection::<Comment>("comments");

    let insert_result = collection
        .insert_one(&new_comment)
        .await
        .map_err(|e| AppError::Database(format!("Failed to create comment: {}", e)))?;

    let new_id = insert_result
        .inserted_id
        .as_object_id()
        .ok_or_else(|| AppError::Internal("Failed to get inserted comment ID".to_string()))?;

    // Update parent's children array if this is a reply
    if let Some(parent_id) = parent_oid {
        comment
            .update_parent_children(parent_id, new_id)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to update parent children: {}", e)))?;
    }

    // Get the inserted comment
    let inserted_comment = collection
        .find_one(doc! { "_id": new_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to retrieve inserted comment: {}", e)))?
        .ok_or(AppError::Internal("Inserted comment not found".to_string()))?;

    // Build reader mappings for this single comment
    let (email_to_avatar, email_to_is_owner) = comment
        .build_reader_mappings(vec![inserted_comment.mail.clone()])
        .await;

    // Build comment tree with single node
    let comment_trees = comment.build_comment_tree(
        std::slice::from_ref(&inserted_comment),
        &email_to_avatar,
        &email_to_is_owner,
    );

    let comment_tree = comment_trees
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Internal("Failed to build comment tree".to_string()))?;

    // Send notification to admin for new comment
    let notification_svc = NotificationService::new(state.db.clone());
    let notification = CommentNotification {
        author: inserted_comment.author.clone(),
        text: inserted_comment.text.clone(),
        email: inserted_comment.mail.clone(),
        ref_type: inserted_comment.ref_type.clone(),
        ref_id: payload.r#ref.clone(),
        ref_title: None, // Will be fetched by notification service
        created: inserted_comment.created,
        is_reply: parent_oid.is_some(),
        parent_author: parent_author.clone(),
        ua: ua_string,
        location: inserted_comment.location.clone(),
    };

    // Spawn notification task in background (don't block response)
    tokio::spawn(async move {
        if let Err(e) = notification_svc
            .send_comment_notification(&notification)
            .await
        {
            tracing::error!("Failed to send comment notification: {:?}", e);
        }
    });

    // Spawn AI spam check in background (non-owner comments only; owner comments are pre-approved)
    if !is_owner {
        let spam_db = state.db.clone();
        let spam_client = state.http_client.clone();
        let spam_comment_id = new_id;
        let spam_text = inserted_comment.text.clone();
        let spam_author = inserted_comment.author.clone();
        let spam_email = inserted_comment.mail.clone();
        tokio::spawn(async move {
            SpamDetector::review_async(
                spam_db,
                spam_client,
                spam_comment_id,
                spam_text,
                spam_author,
                spam_email,
            )
            .await;
        });
    }

    tracing::info!("New comment created by {}", new_comment.mail);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Comment created successfully".to_string(),
        data: comment_tree,
    }))
}
