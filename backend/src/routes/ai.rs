//! AI 相关路由

use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::{doc, oid::ObjectId};
use std::str::FromStr;
use sha1::{Sha1, Digest};

use crate::models::{
    ApiResponse, Post, Note, Page,
    TimeCapsule, TimeCapsuleRequest, TimeCapsuleResponse, TimeSensitivity,
};
use crate::services::{AiService, ChatMessage, ChatRole};
use crate::db_find_one;

/// 内容信息结构
struct ContentInfo {
    title: String,
    text: String,
}

/// 计算内容 SHA1 哈希
fn compute_sha1(content: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// 构建 Time Capsule 分析的 prompt
fn build_analysis_prompt(title: &str, content: &str) -> Vec<ChatMessage> {
    let system_prompt = r###"你是一个内容时效性分析专家。你的任务是分析文章内容，判断其是否属于"易过期"类型。

易过期内容的特征包括：
- 特定版本的技术/框架/库（如 "React 18", "Node.js 20"）
- 具体的 API 接口或配置方式
- 时效性新闻或事件
- 特定日期的活动或促销
- 依赖外部服务的教程
- 软件安装/配置步骤
- 价格信息

不易过期内容的特征包括：
- 编程概念和原理
- 算法和数据结构
- 设计模式
- 人生感悟/随笔
- 历史事件回顾
- 数学/物理等基础知识

请以 JSON 格式返回分析结果：
{
  "sensitivity": "high" | "medium" | "low",
  "reason": "简短的分析理由（80字以内）",
  "markers": ["检测到的易过期元素1", "元素2", ...]
}

只返回 JSON，不要其他内容。"###;

    let user_prompt = format!(
        "请分析以下文章的时效性：\n\n标题：{title}\n\n内容：\n{content}"
    );

    vec![
        ChatMessage { role: ChatRole::System, content: system_prompt.to_string() },
        ChatMessage { role: ChatRole::User, content: user_prompt },
    ]
}

/// 解析 AI 返回的 JSON
fn parse_ai_response(response: &str) -> Result<(TimeSensitivity, String, Vec<String>), String> {
    eprintln!("AI raw response: {response}");

    // 尝试提取 JSON 部分
    let json_str = response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    // 尝试找到 JSON 对象的起始和结束位置
    let json_str = if let (Some(start), Some(end)) = (json_str.find('{'), json_str.rfind('}')) {
        &json_str[start..=end]
    } else {
        json_str
    };

    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse AI response: {e}"))?;

    let sensitivity = match parsed.get("sensitivity").and_then(|v| v.as_str()).unwrap_or("medium") {
        "high" => TimeSensitivity::High,
        "low" => TimeSensitivity::Low,
        _ => TimeSensitivity::Medium,
    };

    let reason = parsed.get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("无法获取分析理由")
        .to_string();

    let markers = parsed.get("markers")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok((sensitivity, reason, markers))
}

/// 分析文章时效性
#[utoipa::path(
    post,
    path = "/api/ai/time-capsule",
    request_body = TimeCapsuleRequest,
    responses(
        (status = 200, description = "成功分析文章时效性", body = ApiResponse<TimeCapsuleResponse>),
        (status = 400, description = "无效的请求参数"),
        (status = 404, description = "文章不存在"),
        (status = 500, description = "服务器内部错误"),
        (status = 503, description = "AI服务不可用")
    ),
    tag = "AI服务"
)]
#[post("/ai/time-capsule", data = "<request>")]
pub async fn analyze_time_capsule(
    db: &State<Database>,
    request: Json<TimeCapsuleRequest>,
) -> Result<Json<ApiResponse<TimeCapsuleResponse>>, Status> {
    // 1. 获取文章内容
    let content_info = fetch_content_by_type(db, &request).await?;

    // 2. 计算当前内容的 SHA1
    let content_hash = compute_sha1(&format!("{}{}", content_info.title, content_info.text));

    // 3. 检查缓存
    if let Some(cached) = get_cached_capsule(db, &request.ref_id, &content_hash).await {
        return Ok(Json(ApiResponse::success(TimeCapsuleResponse {
            sensitivity: cached.sensitivity,
            reason: cached.reason,
            markers: cached.markers,
            is_new: false,
        })));
    }

    // 4. 调用 AI 服务分析
    let (sensitivity, reason, markers) = analyze_with_ai(db, &content_info).await?;

    // 5. 保存到数据库
    save_time_capsule(db, &request, &content_hash, &sensitivity, &reason, &markers).await?;

    Ok(Json(ApiResponse::success(TimeCapsuleResponse {
        sensitivity,
        reason,
        markers,
        is_new: true,
    })))
}

/// 根据类型获取内容
async fn fetch_content_by_type(
    db: &State<Database>,
    request: &TimeCapsuleRequest,
) -> Result<ContentInfo, Status> {
    match request.ref_type.as_str() {
        "post" => {
            let object_id = ObjectId::from_str(&request.ref_id)
                .map_err(|_| Status::BadRequest)?;
            let collection = db.collection::<Post>("posts");
            let post = db_find_one!(collection, doc! { "_id": object_id })?;
            Ok(ContentInfo { title: post.title, text: post.text })
        }
        "note" => {
            let object_id = ObjectId::from_str(&request.ref_id)
                .map_err(|_| Status::BadRequest)?;
            let collection = db.collection::<Note>("notes");
            let note = db_find_one!(collection, doc! { "_id": object_id })?;
            Ok(ContentInfo { title: format!("日记 #{}", note.nid), text: note.text })
        }
        "page" => {
            let collection = db.collection::<Page>("pages");
            let page = db_find_one!(collection, doc! { "slug": &request.ref_id })?;
            Ok(ContentInfo { title: page.title, text: page.text })
        }
        _ => Err(Status::BadRequest),
    }
}

/// 获取缓存的时间胶囊
async fn get_cached_capsule(
    db: &State<Database>,
    ref_id: &str,
    content_hash: &str,
) -> Option<TimeCapsule> {
    let capsules_collection = db.collection::<TimeCapsule>("time_capsules");
    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    eprintln!("Looking for refId: {ref_id}, current_hash: {content_hash}");

    match capsules_collection
        .find_one(doc! { "refId": ref_id })
        .with_options(find_options)
        .await
    {
        Ok(Some(existing)) => {
            eprintln!("Found existing record, db_hash: {}, current_hash: {}", existing.hash, content_hash);
            if existing.hash == content_hash {
                eprintln!("Hash matched, returning cached result");
                Some(existing)
            } else {
                eprintln!("Hash mismatch, will call AI");
                None
            }
        }
        Ok(None) => {
            eprintln!("No existing record found");
            None
        }
        Err(e) => {
            eprintln!("Database query error: {e:?}");
            None
        }
    }
}

/// 使用 AI 分析内容
async fn analyze_with_ai(
    db: &State<Database>,
    content_info: &ContentInfo,
) -> Result<(TimeSensitivity, String, Vec<String>), Status> {
    let ai_service = AiService::from_database(db.inner())
        .await
        .map_err(|e| {
            eprintln!("Failed to init AI service: {e}");
            Status::InternalServerError
        })?;

    if !ai_service.is_enabled() {
        return Err(Status::ServiceUnavailable);
    }

    let messages = build_analysis_prompt(&content_info.title, &content_info.text);
    let ai_response = ai_service
        .chat(messages, Some(0.3), None)
        .await
        .map_err(|e| {
            eprintln!("AI request failed: {e}");
            Status::InternalServerError
        })?;

    parse_ai_response(&ai_response).map_err(|e| {
        eprintln!("Failed to parse AI response: {e}");
        Status::InternalServerError
    })
}

/// 保存时间胶囊到数据库
async fn save_time_capsule(
    db: &State<Database>,
    request: &TimeCapsuleRequest,
    content_hash: &str,
    sensitivity: &TimeSensitivity,
    reason: &str,
    markers: &[String],
) -> Result<(), Status> {
    let capsules_collection = db.collection::<TimeCapsule>("time_capsules");
    let new_capsule = TimeCapsule {
        id: ObjectId::new(),
        ref_id: request.ref_id.clone(),
        ref_type: request.ref_type.clone(),
        sensitivity: sensitivity.clone(),
        reason: reason.to_string(),
        markers: markers.to_vec(),
        hash: content_hash.to_string(),
        created: bson::Bson::DateTime(bson::DateTime::now()),
    };

    capsules_collection
        .insert_one(&new_capsule)
        .await
        .map_err(|e| {
            eprintln!("Failed to save time capsule: {e}");
            Status::InternalServerError
        })?;

    Ok(())
}

/// 获取文章的 Time Capsule 分析结果
#[utoipa::path(
    get,
    path = "/api/ai/time-capsule/{ref_id}",
    params(
        ("ref_id" = String, Path, description = "文章ID")
    ),
    responses(
        (status = 200, description = "成功获取分析结果", body = ApiResponse<TimeCapsuleResponse>),
        (status = 404, description = "分析结果不存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "AI服务"
)]
#[get("/ai/time-capsule/<ref_id>")]
pub async fn get_time_capsule(
    db: &State<Database>,
    ref_id: &str,
) -> Result<Json<ApiResponse<TimeCapsuleResponse>>, Status> {
    let capsules_collection = db.collection::<TimeCapsule>("time_capsules");

    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    let capsule = capsules_collection
        .find_one(doc! { "refId": ref_id })
        .with_options(find_options)
        .await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    Ok(Json(ApiResponse::success(TimeCapsuleResponse {
        sensitivity: capsule.sensitivity,
        reason: capsule.reason,
        markers: capsule.markers,
        is_new: false,
    })))
}