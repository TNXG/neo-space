import { Elysia } from "elysia";
import { getConfig } from "@/config";

const config = getConfig();

/**
 * WebSocket 路由
 *
 * 用于博主桌面客户端的双向通信
 * - GET /ws/owner-desktop - 博主桌面客户端 WebSocket
 */
export const wsRoutes = new Elysia({ prefix: "/ws" })
  // GET /ws/owner-desktop - 博主桌面客户端 WebSocket
  .ws("/owner-desktop", {
    query: {
      token: String,
    },
    open(ws) {
      const token = (ws.data.query as any)?.token;

      // 验证 token（使用环境变量）
      const expectedToken = config.owner?.desktopToken || process.env.OWNER_DESKTOP_TOKEN;

      if (!expectedToken || token !== expectedToken) {
        console.warn("Invalid owner desktop token");
        ws.close(1008, "Invalid token");
        return;
      }

      console.log("Owner desktop client connected");

      // 发送欢迎消息
      ws.send(
        JSON.stringify({
          type: "connected",
          message: "Welcome, owner!",
          timestamp: new Date().toISOString(),
        }),
      );

      // TODO: 集成 EventBus 以接收和发送实时事件
    },
    message(ws, message) {
      console.log("Received message from owner desktop:", message);

      // 处理来自桌面客户端的消息
      try {
        const data = typeof message === "string" ? JSON.parse(message) : message;

        // TODO: 根据消息类型处理不同的操作
        // 例如：广播通知、更新状态等

        // 回复确认
        ws.send(
          JSON.stringify({
            type: "ack",
            originalType: data.type,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Failed to process message",
          }),
        );
      }
    },
    close(ws, code, reason) {
      console.log(`Owner desktop client disconnected: ${code} - ${reason}`);
    },
    error(ws, error) {
      console.error("WebSocket error:", error);
    },
  });
