use std::fmt::Write as _;

use super::{
    ApiResponse, AppError, AppJson, AppResult, Comment, CommentService, CommentState, CommentTree,
    ConnectInfo, CreateCommentRequest, HeaderMap, Json, ObjectId, OptionalAuth, Reader,
    ResponseStatus, SharedState, SocketAddr, State, doc, extract_client_ip,
    extract_request_user_agent, get_ip_location, verify_turnstile,
};
/// Create a new comment
// Keep the endpoint orchestration together to preserve the request flow.
#[allow(clippy::too_many_lines)]
pub async fn create_comment(
    State(state): State<SharedState>,
    auth: OptionalAuth,
    ConnectInfo(peer_addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    AppJson(payload): AppJson<CreateCommentRequest>,
) -> AppResult<Json<ApiResponse<CommentTree>>> {
    let config = state.config();
    if config.comments_disabled {
        return Err(AppError::Forbidden);
    }
    if !config.comments_allow_no_chinese
        && !payload
            .text
            .chars()
            .any(|character| ('\u{4e00}'..='\u{9fff}').contains(&character))
    {
        return Err(AppError::BadRequest(
            "Comment must contain Chinese characters".to_string(),
        ));
    }

    let normalized_ref_type = CommentService::normalize_ref_type(&payload.ref_type);

    // Convert ref string to Bson (ObjectId if valid, otherwise String)
    let ref_bson = if let Ok(oid) = ObjectId::parse_str(&payload.r#ref) {
        bson::Bson::ObjectId(oid)
    } else {
        bson::Bson::String(payload.r#ref.clone())
    };

    // Validate ref_type
    if !["posts", "notes", "pages"].contains(&normalized_ref_type.as_str()) {
        return Err(AppError::BadRequest(
            "Invalid ref_type, must be 'posts', 'notes', or 'pages'".to_string(),
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
        && author.len() > 100
    {
        return Err(AppError::BadRequest(
            "Author name cannot exceed 100 characters".to_string(),
        ));
    }
    if let Some(ref mail) = payload.mail
        && mail.len() > 254
    {
        return Err(AppError::BadRequest(
            "Email address is too long".to_string(),
        ));
    }
    if let Some(ref url) = payload.url
        && url.len() > 500
    {
        return Err(AppError::BadRequest("URL is too long".to_string()));
    }

    let comment = CommentService::new(state.db.clone());

    // Extract client IP from headers
    let client_ip = extract_client_ip(&headers).or_else(|| Some(peer_addr.ip().to_string()));
    if client_ip.as_ref().is_some_and(|ip| {
        config
            .comments_blocked_ips
            .iter()
            .any(|blocked| blocked == ip)
    }) {
        return Err(AppError::Forbidden);
    }

    // Get IP location asynchronously
    let location = if config.comments_record_ip_location
        && let Some(ref ip) = client_ip
    {
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
            .map_err(|e| AppError::Database(format!("Failed to find user: {e}")))?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

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
            auth.is_owner,
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
            let secret = &config.turnstile_secret;
            // Only verify if secret is configured (not the placeholder)
            if !secret.is_empty() && secret != "THISISTURNSTILEKEY" {
                verify_turnstile(token, secret, &state.http_client)
                    .await
                    .map_err(|()| {
                        AppError::BadRequest("CAPTCHA verification failed".to_string())
                    })?;
            }
        } else if !config.turnstile_secret.is_empty()
            && config.turnstile_secret != "THISISTURNSTILEKEY"
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
    let parent_comment = if let Some(parent_id) = parent_oid {
        let parent_collection = state.db.collection::<Comment>("comments");
        parent_collection
            .find_one(doc! { "_id": parent_id })
            .await
            .map_err(|e| AppError::Database(format!("Failed to find parent comment: {e}")))?
            .ok_or_else(|| AppError::BadRequest("Parent comment not found".to_string()))?
    } else {
        Comment::default()
    };

    // Clone UA info for notification before it's moved into comment
    let request_user_agent = extract_request_user_agent(&headers);
    let ua_string = payload.ua.as_ref().map(|ua| {
        let mut details = format!("{} {}", ua.browser, ua.os);
        if let Some(raw_user_agent) = &ua.raw_user_agent
            && !raw_user_agent.is_empty()
        {
            let _ = write!(details, " | UA: {raw_user_agent}");
        }
        if let Some(client_hints) = &ua.client_hints {
            let platform = client_hints.platform.as_deref().unwrap_or("unknown");
            let platform_version = client_hints
                .platform_version
                .as_deref()
                .unwrap_or("unknown");
            let _ = write!(details, " | CH: {platform} {platform_version}");
        }
        details
    });

    // Determine comment state based on user role
    let contains_spam_keyword = config.comments_spam_keywords.iter().any(|keyword| {
        !keyword.trim().is_empty()
            && payload
                .text
                .to_lowercase()
                .contains(&keyword.trim().to_lowercase())
    });
    let state_value = if is_owner {
        CommentState::READ // Admin comments are automatically approved
    } else if contains_spam_keyword {
        CommentState::SPAM
    } else if config.comments_require_audit {
        CommentState::PENDING
    } else {
        CommentState::UNREAD
    };

    let created_at = bson::DateTime::now();
    let root_comment_id =
        parent_oid.map(|parent_id| parent_comment.root_comment_id.unwrap_or(parent_id));

    let new_comment = Comment {
        id: None,
        r#ref: ref_bson,
        ref_type: normalized_ref_type.clone(),
        ref_id: None,
        author,
        mail,
        text: payload.text,
        state: state_value,
        status: None,
        ip: client_ip,
        agent: payload
            .ua
            .as_ref()
            .and_then(|ua| ua.raw_user_agent.clone())
            .or(request_user_agent),
        pin: false,
        is_whispers: false,
        source,
        avatar: Some(avatar_url),
        created: created_at,
        location,
        url: payload.url,
        parent: parent_oid,
        root_comment_id,
        reply_count: 0,
        latest_reply_at: None,
        is_deleted: false,
        ua: payload.ua,
    };

    let collection = state.db.collection::<Comment>("comments");

    let insert_result = collection
        .insert_one(&new_comment)
        .await
        .map_err(|e| AppError::Database(format!("Failed to create comment: {e}")))?;

    let new_id = insert_result
        .inserted_id
        .as_object_id()
        .ok_or_else(|| AppError::Internal("Failed to get inserted comment ID".to_string()))?;

    // 更新旧评论结构下的父评论统计
    if let Some(parent_id) = parent_oid {
        comment
            .register_reply(parent_id, root_comment_id, created_at)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to update reply metadata: {e}")))?;
    }

    let inserted_comment = collection
        .find_one(doc! { "_id": new_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to retrieve inserted comment: {e}")))?
        .ok_or_else(|| AppError::Internal("Inserted comment not found".to_string()))?;

    let comment_tree = crate::services::comment::submission::finish_submission(
        state.clone(),
        inserted_comment,
        parent_comment,
        ua_string,
        &payload.r#ref,
        &normalized_ref_type,
        is_owner,
    )
    .await?;

    tracing::info!("New comment created by {}", new_comment.mail);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Comment created successfully".to_string(),
        data: comment_tree,
    }))
}
