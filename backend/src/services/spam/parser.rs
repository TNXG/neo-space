use serde::Deserialize;

use super::SpamCheckResult;

#[derive(Debug, Deserialize)]
struct BinaryResponse {
    is_spam: bool,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct ScoreResponse {
    score: u8,
    reason: String,
}

fn extract_json(response: &str) -> String {
    let response = response.trim();

    let cleaned = if response.starts_with("```") {
        let stripped = response
            .trim_start_matches('`')
            .trim_start_matches("json")
            .trim_start();

        if let Some(end) = stripped.rfind("```") {
            stripped.get(..end).unwrap_or(stripped).trim()
        } else {
            stripped.trim()
        }
    } else {
        response
    };

    let Some(start) = cleaned.find('{') else {
        return cleaned.to_string();
    };

    let mut depth = 0_i32;
    let mut in_string = false;
    let mut escape_next = false;
    let mut end_exclusive = None;

    for (idx, ch) in cleaned.get(start..).unwrap_or("").char_indices() {
        if escape_next {
            escape_next = false;
            continue;
        }

        match ch {
            '\\' if in_string => escape_next = true,
            '"' => in_string = !in_string,
            '{' if !in_string => depth += 1,
            '}' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    end_exclusive = Some(start + idx + ch.len_utf8());
                    break;
                }
            }
            _ => {}
        }
    }

    end_exclusive
        .and_then(|end| cleaned.get(start..end))
        .or_else(|| cleaned.get(start..))
        .unwrap_or(cleaned)
        .to_string()
}

pub(super) fn parse_binary_response(response: &str) -> Result<SpamCheckResult, String> {
    let json_str = extract_json(response);
    serde_json::from_str::<BinaryResponse>(&json_str)
        .map(|result| SpamCheckResult {
            is_spam: result.is_spam,
            confidence: if result.is_spam { 1.0 } else { 0.0 },
            reason: Some(result.reason),
        })
        .map_err(|error| format!("JSON parse error: {error}, input: {json_str}"))
}

pub(super) fn parse_score_response(
    response: &str,
    threshold: u8,
) -> Result<SpamCheckResult, String> {
    let json_str = extract_json(response);
    serde_json::from_str::<ScoreResponse>(&json_str)
        .map(|result| {
            let score = result.score.min(10);
            SpamCheckResult {
                is_spam: score >= threshold,
                confidence: f32::from(score) / 10.0,
                reason: Some(format!("Score: {score}/10 - {}", result.reason)),
            }
        })
        .map_err(|error| format!("JSON parse error: {error}, input: {json_str}"))
}
