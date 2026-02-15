/**
 * 错误处理中间件
 * 捕获所有错误并返回统一格式的响应
 *
 * 功能：
 * - 捕获路由处理器中抛出的所有错误
 * - 根据错误类型设置适当的 HTTP 状态码
 * - 返回统一的错误响应格式：{ code, status: 'failed', message, data: null }
 * - 记录错误日志以便调试
 *
 * 使用示例：
 * ```typescript
 * import { errorMiddleware } from '@/middleware/error';
 *
 * const app = new Elysia()
 *   .use(errorMiddleware())
 *   .get('/test', () => {
 *     throw new Error('Something went wrong');
 *   });
 * ```
 *
 * 支持的错误类型：
 * - VALIDATION: 验证错误 (400)
 * - NOT_FOUND: 资源不存在 (404)
 * - PARSE: 请求解析错误 (400)
 * - INTERNAL_SERVER_ERROR: 服务器内部错误 (500)
 * - UNKNOWN: 未知错误 (500)
 */

import type { Elysia } from "elysia";

/**
 * 错误处理中间件
 *
 * 根据 Elysia 的错误代码返回适当的 HTTP 状态码和错误消息
 *
 * Elysia 错误代码映射：
 * - VALIDATION: 请求验证失败（schema 验证）
 * - NOT_FOUND: 路由不存在
 * - PARSE: 请求体解析失败
 * - INTERNAL_SERVER_ERROR: 服务器内部错误
 * - UNKNOWN: 未知错误
 */
export function errorMiddleware() {
  return (app: Elysia) =>
    app.onError(({ code, error, set }) => {
      // 记录错误日志
      console.error(`[Error] Code: ${code}, Message:`, error);

      // 如果错误对象包含堆栈信息，也记录下来
      if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
      }

      // 根据错误类型设置状态码和消息
      switch (code) {
        case "VALIDATION":
          set.status = 400;
          return {
            code: 400,
            status: "failed",
            message: "Validation failed",
            data: null,
          };

        case "NOT_FOUND":
          set.status = 404;
          return {
            code: 404,
            status: "failed",
            message: "Resource not found",
            data: null,
          };

        case "PARSE":
          set.status = 400;
          return {
            code: 400,
            status: "failed",
            message: "Failed to parse request",
            data: null,
          };

        case "INTERNAL_SERVER_ERROR":
          set.status = 500;
          return {
            code: 500,
            status: "failed",
            message: "Internal server error",
            data: null,
          };

        case "UNKNOWN":
        default:
        // 对于未知错误，检查是否有自定义的状态码
        // 如果错误对象包含 statusCode 属性，使用它
        {
          const statusCode = (error as any).statusCode || 500;
          set.status = statusCode;

          // 使用错误消息（如果有），否则使用默认消息
          const message = error instanceof Error
            ? error.message
            : "Internal server error";

          return {
            code: statusCode,
            status: "failed",
            message,
            data: null,
          };
        }
      }
    });
}

/**
 * 自定义错误类
 * 可以在路由处理器中抛出这些错误，错误中间件会自动处理
 */

/**
 * HTTP 错误基类
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends HttpError {
  constructor(message: string = "Bad request") {
    super(400, message);
    this.name = "BadRequestError";
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends HttpError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends HttpError {
  constructor(message: string = "Not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends HttpError {
  constructor(message: string = "Internal server error") {
    super(500, message);
    this.name = "InternalServerError";
  }
}
