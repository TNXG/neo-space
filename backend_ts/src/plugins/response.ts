import type { Elysia } from "elysia";
import type { PaginationMeta } from "./pagination";

/**
 * 响应状态枚举
 */
export enum ResponseStatus {
  Success = "success",
  Failed = "failed",
}

/**
 * 标准 API 响应结构（与原 Rust API 一致）
 */
export interface ApiResponse<T> {
  code: number; // HTTP 状态码
  status: ResponseStatus; // 响应状态
  message: string; // 响应消息
  data: T; // 响应数据
}

/**
 * 分页响应数据结构
 */
export interface PaginatedData<T> {
  items: T[]; // 数据列表
  pagination: PaginationMeta; // 分页信息
}

/**
 * 分页响应类型
 */
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

/**
 * 响应格式化插件
 *
 * 功能：
 * - 提供统一的响应格式化函数
 * - 确保所有响应符合原 Rust API 的格式（code, status, message, data）
 * - 支持成功响应、分页响应和错误响应
 *
 * 使用示例：
 * ```typescript
 * app.use(responsePlugin())
 *   .get('/items', ({ success }) => {
 *     return success({ id: 1, name: 'Item' });
 *   })
 *   .get('/list', ({ paginated, createPaginationMeta }) => {
 *     const items = [...];
 *     const total = 100;
 *     return paginated(items, createPaginationMeta(total));
 *   })
 *   .get('/error', ({ error, set }) => {
 *     set.status = 404;
 *     return error(404, 'Not found');
 *   });
 * ```
 */
export function responsePlugin() {
  return (app: Elysia) =>
    app.derive(() => ({
      /**
       * 成功响应
       * @param data 响应数据
       * @param statusCode HTTP 状态码，默认 200
       * @returns 标准 API 响应
       */
      success: <T>(data: T, statusCode: number = 200): ApiResponse<T> => ({
        code: statusCode,
        status: ResponseStatus.Success,
        message: "Success",
        data,
      }),

      /**
       * 成功响应（带自定义消息）
       * @param data 响应数据
       * @param message 自定义消息
       * @param statusCode HTTP 状态码，默认 200
       * @returns 标准 API 响应
       */
      successWithMessage: <T>(
        data: T,
        message: string,
        statusCode: number = 200,
      ): ApiResponse<T> => ({
        code: statusCode,
        status: ResponseStatus.Success,
        message,
        data,
      }),

      /**
       * 分页响应
       * @param items 数据列表
       * @param pagination 分页元数据
       * @returns 分页响应
       */
      paginated: <T>(
        items: T[],
        pagination: PaginationMeta,
      ): PaginatedResponse<T> => ({
        code: 200,
        status: ResponseStatus.Success,
        message: "Success",
        data: { items, pagination },
      }),

      /**
       * 错误响应
       * @param statusCode HTTP 状态码
       * @param message 错误消息
       * @returns 错误响应（data 为 null）
       */
      error: (statusCode: number, message: string): ApiResponse<null> => ({
        code: statusCode,
        status: ResponseStatus.Failed,
        message,
        data: null,
      }),
    }));
}
