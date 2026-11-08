use super::*;
use bson::doc;
use bson::oid::ObjectId;

#[test]
fn clean_or_unknown_results_never_release_manual_review() {
    for state in [CommentState::PENDING, CommentState::UNREAD, CommentState::READ, CommentState::SPAM] {
        assert_eq!(moderation::target_state(state, false), None);
    }
    assert_eq!(moderation::target_state(CommentState::PENDING, true), Some(CommentState::SPAM));
    assert_eq!(moderation::target_state(CommentState::UNREAD, true), Some(CommentState::SPAM));
    assert_eq!(moderation::target_state(CommentState::READ, true), None);
    assert_eq!(moderation::target_state(CommentState::SPAM, true), None);
}

#[test]
fn async_write_is_bound_to_original_state_content_and_no_manual_revision() {
    let id = ObjectId::new();
    let filter = moderation::review_filter(id, CommentState::PENDING, "original");
    assert_eq!(filter.get_object_id("_id").unwrap(), id);
    assert_eq!(filter.get_i32("state").unwrap(), CommentState::PENDING);
    assert_eq!(filter.get_str("text").unwrap(), "original");
    assert_eq!(filter.get_document("moderationRevision").unwrap(), &doc! {"$exists": false});
    assert_eq!(filter.get_document("isDeleted").unwrap(), &doc! {"$ne": true});
    assert_eq!(filter.get("status"), Some(&bson::Bson::Null));
}

#[test]
fn scoring_rejects_invalid_range_and_uses_inclusive_threshold() {
    assert!(!parse_score_response(r#"{"score":4,"reason":"ok"}"#, 5).unwrap().is_spam);
    assert!(parse_score_response(r#"{"score":5,"reason":"spam"}"#, 5).unwrap().is_spam);
    assert!(parse_score_response(r#"{"score":11,"reason":"bad"}"#, 5).is_err());
    assert!(parse_score_response(r#"{"score":0,"reason":"bad threshold"}"#, 0).is_err());
}

#[test]
fn binary_parser_handles_fences_and_escaped_braces_but_not_missing_decisions() {
    assert!(parse_binary_response("```json\n{\"is_spam\":true,\"reason\":\"quoted \\\"}\\\"\"}\n```").unwrap().is_spam);
    assert!(!parse_binary_response(r#"{"is_spam":false,"reason":"normal"}"#).unwrap().is_spam);
    for input in ["", "normal", r#"{"reason":"normal"}"#, r#"{"is_spam":"false","reason":"normal"}"#] {
        assert!(parse_binary_response(input).is_err());
    }
}

#[test]
fn enabled_review_rejects_unknown_mode_and_zero_threshold() {
    let options: CommentOptions = bson::from_document(doc! {"antiSpam":true,"aiReview":true,"aiReviewType":"score","aiReviewThreshold":0}).unwrap();
    assert!(options.validate().is_err());
    let options: CommentOptions = bson::from_document(doc! {"antiSpam":true,"aiReview":true,"aiReviewType":"unknown"}).unwrap();
    assert!(options.validate().is_err());
}

#[test]
fn manual_same_state_decision_cancels_any_outstanding_ai_review() {
    let update = crate::handlers::admin::comments_data::state_update_doc(CommentState::UNREAD);
    assert_eq!(update.get_document("$set").unwrap().get_i32("state").unwrap(), CommentState::UNREAD);
    assert_eq!(update.get_document("$inc").unwrap().get_i32("moderationRevision").unwrap(), 1);
    assert!(update.get_document("$unset").unwrap().contains_key("status"));
}
