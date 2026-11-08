use bson::{Document, doc, oid::ObjectId};

use crate::{app::{Event, SharedState}, models::{Comment, CommentState}};
use super::SpamCheckResult;

/// AI may only demote an untouched submission; clean never means manual approval.
pub(super) fn target_state(original: i32, is_spam: bool) -> Option<i32> {
    (is_spam && matches!(original, CommentState::UNREAD | CommentState::PENDING))
        .then_some(CommentState::SPAM)
}

/// An owner decision, even a same-state decision or edit-and-revert, wins the race.
pub(super) fn review_filter(id: ObjectId, original: i32, text: &str) -> Document {
    doc! {
        "_id": id,
        "state": original,
        "text": text,
        "status": null,
        "isDeleted": { "$ne": true },
        "moderationRevision": { "$exists": false }
    }
}

pub(super) async fn apply(
    state: &SharedState,
    id: ObjectId,
    comment: &Comment,
    result: &SpamCheckResult,
) -> Result<(), String> {
    let Some(new_state) = target_state(comment.state, result.is_spam) else { return Ok(()) };
    let updated = state.db.collection::<Document>("comments")
        .update_one(
            review_filter(id, comment.state, &comment.text),
            doc! { "$set": { "state": new_state }, "$unset": { "status": "" } },
        ).await.map_err(|error| error.to_string())?;
    if updated.modified_count == 0 {
        tracing::debug!(%id, "Submission changed during AI review; preserving current moderation");
        return Ok(());
    }
    // Background mutations do not pass through request middleware.
    state.response_cache.invalidate_all();
    let _ = state.event_bus.send(Event::CommentUpdated { id: id.to_hex() });
    crate::tasks::isr::trigger_isr_revalidation(state, "comments", None).await;
    Ok(())
}
