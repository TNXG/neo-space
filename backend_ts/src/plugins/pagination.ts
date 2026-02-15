import type { Elysia } from "elysia";

/**
 * 分页参数接口
 */
export interface PaginationParams {
  page?: number;
  size?: number;
}

/**
 * 分页元数据接口（与原 Rust API 一致）
 */
export interface PaginationMeta {
  total: number; // 总记录数
  current_page: number; // 当前页码
  total_page: number; // 总页数
  size: number; // 每页大小
  has_next_page: boolean; // 是否有下一页
  has_prev_page: boolean; // 是否有上一页
}

/**
 * 分页插件
 *
 * 功能：
 * - 解析 page 和 size 查询参数
 * - 验证参数并设置默认值（page=1, size=10）
 * - 限制最大 size 为 100
 * - 计算 skip 值用于数据库查询
 * - 提供 createPaginationMeta 函数生成分页元数据
 *
 * 使用示例：
 * ```typescript
 * app.use(paginationPlugin())
 *   .get('/items', ({ pagination, createPaginationMeta }) => {
 *     const { page, size, skip } = pagination;
 *     const items = await db_read('db', 'collection', {}, { skip, limit: size });
 *     const total = await db_count('db', 'collection');
 *     return { items, pagination: createPaginationMeta(total) };
 *   });
 * ```
 */
export function paginationPlugin() {
  return (app: Elysia) =>
    app.derive(({ query }) => {
      // 解析 page 参数，默认为 1，最小为 1
      const parsedPage = Number.parseInt(query.page as string);
      const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);

      // 解析 size 参数，默认为 10，最小为 1，最大为 100
      const parsedSize = Number.parseInt(query.size as string);
      const size = Math.min(100, Math.max(1, Number.isNaN(parsedSize) ? 10 : parsedSize));

      // 计算 skip 值用于数据库查询
      const skip = (page - 1) * size;

      return {
        pagination: { page, size, skip },
        createPaginationMeta: (total: number): PaginationMeta => {
          // 计算总页数
          const total_page = Math.ceil(total / size);

          return {
            total,
            current_page: page,
            total_page,
            size,
            has_next_page: page < total_page,
            has_prev_page: page > 1,
          };
        },
      };
    });
}
