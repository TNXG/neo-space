//! WebSocket 路由
//! 用于博主桌面客户端的双向通信

use rocket::State;
use rocket_ws::{Channel, WebSocket};

use crate::services::OwnerWebSocketService;
use crate::websocket::event_bus::EventBus;

/// 博主桌面客户端 WebSocket 端点（使用环境变量认证）
#[get("/owner-desktop?<token>")]
pub fn owner_desktop_ws(
    ws: WebSocket,
    token: Option<String>,
    event_bus: &State<EventBus>,
) -> Channel<'static> {
    let event_bus = event_bus.inner().clone();

    ws.channel(move |stream| {
        Box::pin(OwnerWebSocketService::handle_connection(
            stream, event_bus, token,
        ))
    })
}

/// 返回所有 WebSocket 路由
pub fn routes() -> Vec<rocket::Route> {
    routes![owner_desktop_ws]
}
