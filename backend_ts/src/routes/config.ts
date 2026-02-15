import { Elysia } from "elysia";
import { getConfig } from "@/config";
import { cache } from "@/lib/cache";
import { db_find } from "@/lib/db";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const CONFIGS_COLLECTION = "configs";

// 缓存配置
const CACHE_KEY = "site:config";
const CACHE_TTL = 5 * 60; // 5 分钟

/**
 * Config 路由处理器
 *
 * 提供以下端点：
 * - GET /config - 获取站点配置（带缓存）
 * - POST /config/invalidate - 使缓存失效（需要认证）
 */
export const configRoutes = new Elysia({ prefix: "/config" })
  .use(responsePlugin())

  // GET /config - 获取站点配置（带缓存）
  .get("/", async ({ success, error, set }) => {
    try {
      // 尝试从缓存获取
      const siteConfig = await cache.getOrSet(
        CACHE_KEY,
        async () => {
          console.log("[Cache] Site config cache miss, fetching from database");
          
          // 从数据库获取配置
          // 假设配置存储在 configs 集合中，只有一条记录
          const configDoc = await db_find(DB_NAME, CONFIGS_COLLECTION, {});
          
          if (!configDoc) {
            // 如果没有配置，返回默认配置
            return {
              name: "My Blog",
              description: "A personal blog",
              url: config.server.host,
              owner: {
                name: "Admin",
                email: "admin@example.com",
                avatar: "",
              },
              social: {},
              seo: {
                keywords: [],
                description: "",
              },
            };
          }

          return configDoc;
        },
        CACHE_TTL,
      );

      return success(siteConfig);
    } catch (err) {
      console.error("Error fetching site config:", err);
      set.status = 500;
      return error(500, "Failed to fetch site config");
    }
  })

  // POST /config/invalidate - 使缓存失效
  .post("/invalidate", ({ success }) => {
    const deleted = cache.delete(CACHE_KEY);
    console.log(`[Cache] Site config cache invalidated: ${deleted}`);
    return success({ invalidated: deleted });
  });
