#![allow(clippy::unwrap_used)]

use super::*;
use serde_json::json;

fn options(provider_type: &str, enabled: bool) -> AiOptionsValue {
    serde_json::from_value(json!({
        "providers":[{"id":"primary","type":provider_type,"enabled":enabled,"endpoint":"https://example.com/v1","apiKey":"secret","defaultModel":"default-model"}],
        "commentReviewModel":{"providerId":"primary"},
        "summaryModel":{"providerId":"primary"},
        "translationModel":{"providerId":"primary"},
        "enableSummary":true,"enableTranslation":true
    })).unwrap()
}

#[test]
fn jev_only_supports_comment_review() {
    assert!(to_ai_config(options("jev", true), AiUsage::CommentReview).is_ok());
    assert!(to_ai_config(options("jev", true), AiUsage::Summary).is_err());
    assert!(to_ai_config(options("jev", true), AiUsage::Translation).is_err());
}

#[test]
fn review_does_not_fall_back_to_another_provider() {
    let mut value = options("openai", true);
    value.comment_review_model.as_mut().unwrap().provider_id = "missing".into();
    assert!(to_ai_config(value, AiUsage::CommentReview).is_err());
    let mut value = options("openai", true);
    value.comment_review_model = None;
    assert!(to_ai_config(value, AiUsage::CommentReview).is_err());
}

#[test]
fn disabled_provider_and_empty_credentials_do_not_become_enabled() {
    assert!(
        !to_ai_config(options("openai", false), AiUsage::CommentReview)
            .unwrap()
            .enabled
    );
    let mut value = options("jev", true);
    value.providers.first_mut().unwrap().api_key.clear();
    assert!(to_ai_config(value, AiUsage::CommentReview).is_err());
}

#[test]
fn saving_jev_as_a_chat_feature_is_rejected_even_when_feature_disabled() {
    let mut value = options("jev", true);
    value.enable_summary = false;
    value.enable_translation = false;
    assert!(validation::validate_assignments(&value).is_err());
    value.summary_model = None;
    value.translation_model = None;
    assert!(validation::validate_assignments(&value).is_ok());
    value.enable_summary = true;
    assert!(validation::validate_assignments(&value).is_err());
}
