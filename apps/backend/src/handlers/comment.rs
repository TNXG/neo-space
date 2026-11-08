//! Comment handlers

mod create;
pub use create::create_comment;

use crate::{
    app::SharedState,
    auth::extractors::OptionalAuth,
    error::{AppError, AppJson, AppQuery, AppResult},
    external::ip_location::get_ip_location,
    models::{
        comment::{Comment, CommentListResponse, CommentState, CommentTree, CreateCommentRequest},
        common::{ApiResponse, PaginatedData, ResponseStatus},
        user::Reader,
    },
    services::{
        comment::CommentService,
        helpers::{extract_client_ip, verify_turnstile},
    },
};
use axum::extract::ConnectInfo;
use axum::http::HeaderMap;
use axum::{Json, extract::State};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

fn extract_request_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

/// Query parameters for listing comments
#[derive(Debug, Deserialize)]
pub struct ListCommentsQuery {
    /// Reference ID (post or note ID) - also accepts `ref_id` for backward compatibility
    #[serde(alias = "ref_id")]
    pub r#ref: Option<String>,
    /// Reference type ("posts" / "notes" / "pages")
    pub ref_type: Option<String>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub state: Option<i32>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ListCommentsResponseData {
    Public(CommentListResponse),
    Admin(PaginatedData<crate::handlers::admin::comments_data::AdminCommentItem>),
}

/// List comments with tree structure
pub async fn list_comments(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<ListCommentsQuery>,
    auth: OptionalAuth,
) -> AppResult<Json<ApiResponse<ListCommentsResponseData>>> {
    let Some(r#ref) = query.r#ref else {
        if auth.is_owner {
            let admin_data = crate::handlers::admin::comments_data::list_comments_admin_data(
                &state.db,
                crate::handlers::admin::comments_data::ListCommentsAdminQuery {
                    page: query.page,
                    size: query.size,
                    state: query.state,
                },
            )
            .await?;

            return Ok(Json(ApiResponse {
                code: 200,
                status: ResponseStatus::Success,
                message: "Success".to_string(),
                data: ListCommentsResponseData::Admin(admin_data),
            }));
        }

        return Err(AppError::BadRequest("Missing ref parameter".to_string()));
    };

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
    let (email_to_avatar, email_to_is_owner, email_to_source) =
        comment.build_reader_mappings(emails).await;

    // Build comment tree
    let comment_trees = comment.build_comment_tree(
        &comments,
        &email_to_avatar,
        &email_to_is_owner,
        &email_to_source,
    );

    // Count all comments (not just root trees) to match Rocket behavior
    let count = comments.len() as i64;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: ListCommentsResponseData::Public(CommentListResponse {
            comments: comment_trees,
            count,
        }),
    }))
}

