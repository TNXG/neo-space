//! SSE (Server-Sent Events) 路由
//! 用于向前端推送实时状态更新

use rocket::State;
use rocket::response::stream::EventStream;

use crate::services::ReaderSSEService;
use crate::websocket::event_bus::EventBus;

/// 读者 SSE 端点 - 只接收服务器推送，不上报
#[get("/reader?<page_type>&<page_id>&<page_title>&<fingerprint>")]
pub fn reader_sse(
    event_bus: &State<EventBus>,
    page_type: Option<String>,
    page_id: Option<String>,
    page_title: Option<String>,
    fingerprint: Option<String>,
) -> EventStream![] {
    let event_bus = event_bus.inner().clone();
    ReaderSSEService::create_stream(event_bus, page_type, page_id, page_title, fingerprint)
}

/// 返回所有 SSE 路由
pub fn routes() -> Vec<rocket::Route> {
    routes![reader_sse]
}
