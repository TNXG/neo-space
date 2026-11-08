use serde_json::json;

use super::merge_option_value;

#[test]
fn merges_nested_option_objects() {
    let mut current = json!({ "smtp": { "host": "old", "port": 587 }, "enable": true });
    merge_option_value(&mut current, json!({ "smtp": { "host": "new" } }));

    assert_eq!(
        current,
        json!({ "smtp": { "host": "new", "port": 587 }, "enable": true })
    );
}

#[test]
fn merges_oauth_providers_by_type() {
    let mut current = json!({
        "providers": [
            { "type": "github", "enabled": true },
            { "type": "google", "enabled": false }
        ]
    });
    merge_option_value(
        &mut current,
        json!({ "providers": [{ "type": "google", "enabled": true }] }),
    );

    assert_eq!(
        current,
        json!({
            "providers": [
                { "type": "github", "enabled": true },
                { "type": "google", "enabled": true }
            ]
        })
    );
}
