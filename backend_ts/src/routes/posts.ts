import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { cache } from "@/lib/cache";
import { db_count, db_find, db_findById, db_read } from "@/lib/db";
import { paginationPlugin } from "@/plugins/pagination";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "posts";

// 缓存配置
const HOT_POSTS_CACHE_KEY = "posts:hot";
const HOT_POSTS_CACHE_TTL = 15 * 60; // 15 分钟

/**
 * Posts 路由处理器
 *
 * 提供以下端点：
 * - GET /posts - 获取文章列表（支持分页、过滤、排序）
 * - GET /posts/hot - 获取热门文章（带缓存）
 * - GET /posts/:id - 根据 ID 获取文章
 * - GET /posts/slug/:slug - 根据 slug 获取文章
 * - GET /posts/:id/adjacent - 获取相邻文章
 * - POST /posts/invalidate-cache - 使缓存失效
 */
export const postsRoutes = new Elysia({ prefix: "/posts" })
  .use(paginationPlugin())
  .use(responsePlugin())

  // GET /posts - 列表
  .get(
    "/",
    async ({ query, pagination, createPaginationMeta, paginated, error, set }) => {
      const { _page, size, skip } = pagination;

      try {
        // 构建过滤器
        const filter: any = { isPublished: true };

        // 分类过滤
        if (query.category) {
          // 验证 ObjectId 格式
          if (!ObjectId.isValid(query.category)) {
            set.status = 400;
            return error(400, "Invalid category ID format");
          }
          filter.categoryId = query.category;
        }

        // 标签过滤
        if (query.tag) {
          filter.tags = query.tag;
        }

        // 构建排序
        const sort: any = {};
        if (query.sortBy === "created") {
          sort.created = query.order === "asc" ? 1 : -1;
        } else if (query.sortBy === "modified") {
          sort.modified = query.order === "asc" ? 1 : -1;
        } else {
          // 默认按创建时间倒序
          sort.created = -1;
        }

        // 查询数据
        const [posts, total] = await Promise.all([
          db_read(DB_NAME, COLLECTION, filter, { skip, limit: size, sort }),
          db_count(DB_NAME, COLLECTION, filter),
        ]);

        return paginated(posts, createPaginationMeta(total));
      } catch (err) {
        console.error("Error fetching posts:", err);
        set.status = 500;
        return error(500, "Failed to fetch posts");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        size: t.Optional(t.String()),
        category: t.Optional(t.String()),
        tag: t.Optional(t.String()),
        sortBy: t.Optional(t.Union([t.Literal("created"), t.Literal("modified")])),
        order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
      }),
    },
  )

  // GET /posts/hot - 获取热门文章（带缓存）
  .get("/hot", async ({ success, error, set }) => {
    try {
      // 尝试从缓存获取
      const hotPosts = await cache.getOrSet(
        HOT_POSTS_CACHE_KEY,
        async () => {
          console.log("[Cache] Hot posts cache miss, fetching from database");
          
          // 获取热门文章：按浏览量排序，取前 10 篇
          const posts = await db_read(
            DB_NAME,
            COLLECTION,
            { isPublished: true },
            { sort: { "count.read": -1 }, limit: 10 },
          );

          return posts;
        },
        HOT_POSTS_CACHE_TTL,
      );

      return success(hotPosts);
    } catch (err) {
      console.error("Error fetching hot posts:", err);
      set.status = 500;
      return error(500, "Failed to fetch hot posts");
    }
  })

  // GET /posts/slug/:slug - 根据 slug 获取
  // 注意：这个路由必须在 /:id 之前定义，否则 "slug" 会被当作 ID 处理
  .get("/slug/:slug", async ({ params, success, error, set }) => {
    try {
      const post = await db_find(DB_NAME, COLLECTION, { slug: params.slug });

      if (!post) {
        set.status = 404;
        return error(404, "Post not found");
      }

      return success(post);
    } catch (err) {
      console.error("Error fetching post by slug:", err);
      set.status = 500;
      return error(500, "Failed to fetch post");
    }
  })

  // GET /posts/:id - 根据 ID 获取
  .get("/:id", async ({ params, success, error, set }) => {
    try {
      // 验证 ID 格式
      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid post ID format");
      }

      const post = await db_findById(DB_NAME, COLLECTION, params.id);

      if (!post) {
        set.status = 404;
        return error(404, "Post not found");
      }

      return success(post);
    } catch (err) {
      console.error("Error fetching post by ID:", err);
      set.status = 500;
      return error(500, "Failed to fetch post");
    }
  })

  // GET /posts/:id/adjacent - 获取相邻文章
  .get("/:id/adjacent", async ({ params, success, error, set }) => {
    try {
      // 验证 ID 格式
      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid post ID format");
      }

      const currentPost = await db_findById(DB_NAME, COLLECTION, params.id);

      if (!currentPost) {
        set.status = 404;
        return error(404, "Post not found");
      }

      // 查询相邻文章
      const [prevResults, nextResults] = await Promise.all([
        // 上一篇：创建时间小于当前文章，按创建时间倒序，取第一条
        db_read(
          DB_NAME,
          COLLECTION,
          { created: { $lt: currentPost.created }, isPublished: true },
          { sort: { created: -1 }, limit: 1 },
        ),
        // 下一篇：创建时间大于当前文章，按创建时间升序，取第一条
        db_read(
          DB_NAME,
          COLLECTION,
          { created: { $gt: currentPost.created }, isPublished: true },
          { sort: { created: 1 }, limit: 1 },
        ),
      ]);

      return success({
        prev: prevResults[0] || null,
        next: nextResults[0] || null,
      });
    } catch (err) {
      console.error("Error fetching adjacent posts:", err);
      set.status = 500;
      return error(500, "Failed to fetch adjacent posts");
    }
  })

  // POST /posts/invalidate-cache - 使缓存失效
  .post("/invalidate-cache", ({ success }) => {
    const deleted = cache.delete(HOT_POSTS_CACHE_KEY);
    console.log(`[Cache] Hot posts cache invalidated: ${deleted}`);
    return success({ invalidated: deleted });
  });
