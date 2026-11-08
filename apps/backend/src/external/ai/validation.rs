use super::{AiOptionsValue, AiUsage, get_selected_provider_id, to_ai_config};
use crate::models::options::RawOption;
use bson::{Bson, doc};
use mongodb::Database;

pub(super) fn validate_assignments(options: &AiOptionsValue) -> Result<(), String> {
    for (usage, enabled) in [
        (AiUsage::Summary, options.enable_summary),
        (AiUsage::Translation, options.enable_translation),
    ] {
        let selected = get_selected_provider_id(options, usage);
        let provider = selected
            .and_then(|id| options.providers.iter().find(|provider| provider.id == id))
            .or_else(|| {
                (selected.is_none() && enabled)
                    .then(|| options.providers.iter().find(|provider| provider.enabled))
                    .flatten()
            });
        if provider.is_some_and(|provider| provider.provider_type == "jev") {
            return Err(format!("Jev supports comment review only, not {usage:?}"));
        }
    }
    Ok(())
}

/// Reject incompatible Jev assignments and changes that would break active comment review.
pub async fn validate_ai_options(db: &Database, value: &Bson) -> Result<(), String> {
    let options: AiOptionsValue =
        bson::from_bson(value.clone()).map_err(|error| format!("Invalid AI options: {error}"))?;
    validate_assignments(&options)?;
    let comment_options = db
        .collection::<RawOption>("options")
        .find_one(doc! {"name": "commentOptions"})
        .await
        .map_err(|error| format!("Failed to load comment options: {error}"))?;
    let review_enabled = comment_options
        .as_ref()
        .and_then(|option| option.value.as_document())
        .is_some_and(|document| {
            document.get_bool("antiSpam").unwrap_or(false)
                && document.get_bool("aiReview").unwrap_or(false)
        });
    if review_enabled {
        let config = to_ai_config(options, AiUsage::CommentReview)?;
        if !config.enabled {
            return Err("Cannot disable the reviewer while comment AI review is enabled".into());
        }
    }
    Ok(())
}
