import { Elysia } from "elysia";
import { getConfig } from "@/config";
import { cache } from "@/lib/cache";
import { db_count, db_read } from "@/lib/db";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const CATEGORIES_COLLECTION = "categories";
const POSTS_COLLECTION = "posts";

// 缓存配置
const CACHE_KEY = "categories:list";
const CACHE_TTL = 10 * 60; // 10 分钟

/**
 * Categories 路由处理器
 *
 * 提供以下端点：
 * - GET /categories - 获取分类列表（包含文章数量）
 * - POST /categories/invalidate - 使缓存失效（需要认证）
 */
export const categoriesRoutes = new Elysia({ prefix: "/categories" })
  .use(responsePlugin())

  // GET /categories - 列表（包含文章数量，带缓存）
  .get("/", async ({ success, error, set }) => {
    try {
      // 尝试从缓存获取
      const categoriesWithCount = await cache.getOrSet(
        CACHE_KEY,
        async () => {
          console.log("[Cache] Categories cache miss, fetching from database");

          // 获取所有分类
          const categories = await db_read(DB_NAME, CATEGORIES_COLLECTION, {}, { sort: { created: -1 } });

          // 为每个分类计算已发布文章数量
          return await Promise.all(
            categories.map(async (category) => {
              const count = await db_count(DB_NAME, POSTS_COLLECTION, {
                categoryId: category._id.toString(),
                isPublished: true,
              });

              return {
                ...category,
                count,
              };
            }),
          );
        },
        CACHE_TTL,
      );

      return success(categoriesWithCount);
    } catch (err) {
      console.error("Error fetching categories:", err);
      set.status = 500;
      return error(500, "Failed to fetch categories");
    }
  })

  // POST /categories/invalidate - 使缓存失效
  .post("/invalidate", ({ success }) => {
    const deleted = cache.delete(CACHE_KEY);
    console.log(`[Cache] Categories cache invalidated: ${deleted}`);
    return success({ invalidated: deleted });
  });
