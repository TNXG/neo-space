use super::*;

/// A legacy status must determine the one displayed bucket even when state contradicts it.
#[test]
fn legacy_status_overrides_numeric_state_for_display() {
    for (status, numeric, expected) in [
        ("approved", 2, 1),
        ("read", 3, 1),
        ("pending", 0, 3),
        ("spam", 1, 2),
        ("rejected", 0, 2),
        ("unknown", 3, 3),
    ] {
        assert_eq!(effective_state(&doc! { "status": status, "state": numeric }), expected);
    }
    assert_eq!(effective_state(&doc! {}), 0);
    assert_eq!(effective_state(&doc! { "state": "1" }), 0);
}

/// Stored avatars win; legacy documents without one must still render the site's email avatar.
#[test]
fn owner_projection_derives_email_avatar_only_when_missing() {
    let stored = admin_comment_from_document(doc! {
        "avatar": "https://cdn.example/avatar.png",
        "mail": "reader@example.test"
    });
    assert_eq!(stored.avatar.as_deref(), Some("https://cdn.example/avatar.png"));

    let derived = admin_comment_from_document(doc! { "mail": "reader@example.test" });
    assert_eq!(
        derived.avatar.as_deref(),
        Some("https://cravatar.cn/avatar/3d2103e0ba81d0304817a7ced63dc657")
    );

    assert_eq!(admin_comment_from_document(doc! {}).avatar, None);
}

#[test]
fn owner_filter_compares_each_bucket_against_the_canonical_state_expression() {
    let canonical = doc! {
        "$switch": {
            "branches": [
                { "case": { "$in": ["$status", ["approved", "read"]] }, "then": 1 },
                { "case": { "$eq": ["$status", "pending"] }, "then": 3 },
                { "case": { "$in": ["$status", ["spam", "rejected"]] }, "then": 2 },
            ],
            "default": { "$cond": [
                { "$eq": [{ "$type": "$state" }, "int"] }, "$state", 0
            ] }
        }
    };
    for state in [0, 1, 2, 3] {
        assert_eq!(state_filter(state), doc! { "$expr": { "$eq": [canonical.clone(), state] } });
    }
}
