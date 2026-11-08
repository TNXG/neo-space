//! Post-insert comment projection, notifications and AI review scheduling.

use super::CommentService;
use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::{Comment, CommentTree},
    services::{
        notification::{CommentNotification, NotificationService},
        spam::SpamDetector,
    },
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;

fn find_comment(comments: &[CommentTree], target: &str) -> Option<CommentTree> {
    for comment in comments {
        if comment.id == target {
            return Some(comment.clone());
        }
        if let Some(found) = find_comment(&comment.children, target) {
            return Some(found);
        }
    }
    None
}

/// Rebuild the submitted tree node, then schedule existing notifications and safe AI review.
pub async fn finish_submission(
    state: SharedState,
    inserted: Comment,
    parent: Comment,
    ua: Option<String>,
    ref_id: &str,
    ref_type: &str,
    is_owner: bool,
) -> AppResult<CommentTree> {
    let id = inserted
        .id
        .ok_or_else(|| AppError::Internal("Inserted comment has no ID".into()))?;
    let service = CommentService::new(state.db.clone());
    let mut cursor = state
        .db
        .collection::<Comment>("comments")
        .find(CommentService::build_ref_filter(ref_id, ref_type))
        .sort(doc! { "created": 1 })
        .await
        .map_err(|error| AppError::Database(format!("Failed to reload comments: {error}")))?;
    let mut comments = Vec::new();
    while let Some(comment) = cursor.try_next().await.map_err(|error| {
        AppError::Database(format!("Failed to deserialize reloaded comment: {error}"))
    })? {
        comments.push(comment);
    }
    let (avatars, owners, sources) = service
        .build_reader_mappings(
            comments
                .iter()
                .map(|comment| comment.mail.clone())
                .collect(),
        )
        .await;
    let trees = CommentService::build_comment_tree(&comments, &avatars, &owners, &sources);
    let tree = find_comment(&trees, &id.to_hex())
        .ok_or_else(|| AppError::Internal("Failed to build inserted comment tree".into()))?;
    let parent_id: Option<ObjectId> = inserted.parent;
    let notification = CommentNotification {
        comment_id: id.to_hex(),
        author: inserted.author.clone(),
        text: inserted.text.clone(),
        email: inserted.mail.clone(),
        ref_type: ref_type.to_string(),
        ref_id: ref_id.to_string(),
        ref_title: None,
        created: inserted.created,
        is_reply: parent_id.is_some(),
        parent_comment_id: parent_id.map(bson::oid::ObjectId::to_hex),
        parent_author: parent_id.is_some().then_some(parent.author),
        parent_author_email: parent_id.is_some().then_some(parent.mail),
        ua,
        location: inserted.location.clone(),
    };
    let notification_service = NotificationService::new(state.db.clone());
    tokio::spawn(async move {
        if let Err(error) = notification_service
            .send_comment_notification(&notification)
            .await
        {
            tracing::error!(?error, "Failed to send comment notification");
        }
    });
    if !is_owner {
        tokio::spawn(SpamDetector::review_async(state, inserted));
    }
    Ok(tree)
}
