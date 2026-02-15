import { Elysia, t } from "elysia";
import { getConfig } from "@/config";
import { db_count, db_read } from "@/lib/db";
import { paginationPlugin } from "@/plugins/pagination";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "recentlies";

/**
 * Recentlies 路由处理器
 *
 * 提供以下端点：
 * - GET /recentlies - 获取动态列表（支持分页和过滤）
 */
export const recentliesRoutes = new Elysia({ prefix: "/recentlies" })
  .use(paginationPlugin())
  .use(responsePlugin())

  // GET /recentlies - 列表
  .get(
    "/",
    async ({ query, pagination, createPaginationMeta, paginated, error, set }) => {
      const { size, skip } = pagination;

      try {
        // 构建过滤器
        const filter: any = {};

        // 类型过滤
        if (query.type) {
          filter.refType = query.type;
        }

        // 日期范围过滤
        if (query.startDate || query.endDate) {
          filter.created = {};
          if (query.startDate) {
            filter.created.$gte = new Date(query.startDate);
          }
          if (query.endDate) {
            filter.created.$lte = new Date(query.endDate);
          }
        }

        // 构建排序（默认按创建时间倒序）
        const sort = { created: -1 };

        // 查询数据
        const [recentlies, total] = await Promise.all([
          db_read(DB_NAME, COLLECTION, filter, { skip, limit: size, sort }),
          db_count(DB_NAME, COLLECTION, filter),
        ]);

        return paginated(recentlies, createPaginationMeta(total));
      } catch (err) {
        console.error("Error fetching recentlies:", err);
        set.status = 500;
        return error(500, "Failed to fetch recentlies");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        size: t.Optional(t.String()),
        type: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
    },
  );
