import { Elysia, t } from "elysia";
import { getConfig } from "@/config";
import { db_find } from "@/lib/db";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "pages";

/**
 * Pages 路由处理器
 *
 * 提供以下端点：
 * - GET /pages/:slug - 根据 slug 获取页面
 */
export const pagesRoutes = new Elysia({ prefix: "/pages" })
  .use(responsePlugin())

  // GET /pages/:slug - 根据 slug 获取页面
  .get("/:slug", async ({ params, success, error, set }) => {
    try {
      const page = await db_find(DB_NAME, COLLECTION, { slug: params.slug });

      if (!page) {
        set.status = 404;
        return error(404, "Page not found");
      }

      return success(page);
    } catch (err) {
      console.error("Error fetching page by slug:", err);
      set.status = 500;
      return error(500, "Failed to fetch page");
    }
  });
