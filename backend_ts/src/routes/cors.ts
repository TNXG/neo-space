import { Elysia } from "elysia";

/**
 * CORS 测试路由
 *
 * 用于测试 CORS 配置
 * - GET /cors/:status - 返回指定状态码
 */
export const corsRoutes = new Elysia()
  // GET /cors/:status - 返回指定状态码
  .get("/cors/:status", ({ params, set }) => {
    const status = parseInt(params.status, 10);

    // 验证状态码
    if (isNaN(status) || status < 100 || status > 599) {
      set.status = 400;
      return { error: "Invalid status code" };
    }

    set.status = status;
    return {
      status,
      message: `CORS test with status ${status}`,
      timestamp: new Date().toISOString(),
    };
  });
