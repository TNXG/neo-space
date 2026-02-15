import { Elysia } from "elysia";

/**
 * SSE (Server-Sent Events) 路由
 *
 * 用于向前端推送实时状态更新
 * - GET /sse/reader - 读者 SSE 端点
 */
export const sseRoutes = new Elysia({ prefix: "/sse" })
  // GET /sse/reader - 读者 SSE 端点
  .get("/reader", ({ query, set }) => {
    // 设置 SSE 响应头
    set.headers["Content-Type"] = "text/event-stream";
    set.headers["Cache-Control"] = "no-cache";
    set.headers.Connection = "keep-alive";

    const { page_type, page_id, page_title } = query;

    // 创建 SSE 流
    const stream = new ReadableStream({
      start(controller) {
        // 发送初始连接消息
        const initialMessage = `data: ${JSON.stringify({
          type: "connected",
          pageType: page_type,
          pageId: page_id,
          pageTitle: page_title,
          timestamp: new Date().toISOString(),
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initialMessage));

        // 保持连接活跃（每 30 秒发送心跳）
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = `data: ${JSON.stringify({
              type: "heartbeat",
              timestamp: new Date().toISOString(),
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(heartbeat));
          } catch {
            clearInterval(heartbeatInterval);
            controller.close();
          }
        }, 30000);

        // TODO: 集成 EventBus 以接收实时事件
        // 当前实现为基础版本，后续需要连接到 EventBus

        // 清理函数
        return () => {
          clearInterval(heartbeatInterval);
        };
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  });
