import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_count, db_find, db_findById, db_read } from "@/lib/db";
import { paginationPlugin } from "@/plugins/pagination";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const USERS_COLLECTION = "users";
const READERS_COLLECTION = "readers";

/**
 * Users 路由处理器
 *
 * 提供以下端点：
 * - GET /user/profile - 获取用户资料（公开信息）
 * - GET /readers - 读者列表（支持分页）
 * - GET /readers/:id - 根据 ID 获取读者
 */
export const usersRoutes = new Elysia({ prefix: "/api" })
  .use(paginationPlugin())
  .use(responsePlugin())

  // GET /user/profile - 获取用户资料（公开信息）
  .get("/user/profile", async ({ success, error, set }) => {
    try {
      // 查询用户集合，只投影非敏感字段
      const user = await db_find(DB_NAME, USERS_COLLECTION, {});

      if (!user) {
        set.status = 404;
        return error(404, "未找到用户");
      }

      // 只返回公开信息
      const publicProfile = {
        _id: user._id,
        username: user.username,
        name: user.name,
        introduce: user.introduce,
        avatar: user.avatar,
        mail: user.mail,
        url: user.url,
        created: user.created,
        lastLoginTime: user.lastLoginTime,
        socialIds: user.socialIds,
      };

      return success(publicProfile);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      set.status = 500;
      return error(500, "获取用户资料失败");
    }
  })

  // GET /readers - 读者列表（支持分页）
  .get(
    "/readers",
    async ({ pagination, createPaginationMeta, paginated, error, set }) => {
      const { _page, size, skip } = pagination;

      try {
        // 查询读者列表，按创建时间倒序
        const [readers, total] = await Promise.all([
          db_read(DB_NAME, READERS_COLLECTION, {}, { skip, limit: size, sort: { createdAt: -1 } }),
          db_count(DB_NAME, READERS_COLLECTION, {}),
        ]);

        return paginated(readers, createPaginationMeta(total));
      } catch (err) {
        console.error("Error fetching readers:", err);
        set.status = 500;
        return error(500, "获取读者列表失败");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        size: t.Optional(t.String()),
      }),
    },
  )

  // GET /readers/:id - 根据 ID 获取读者
  .get("/readers/:id", async ({ params, success, error, set }) => {
    try {
      // 验证 ID 格式
      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "无效的 ID 格式");
      }

      const reader = await db_findById(DB_NAME, READERS_COLLECTION, params.id);

      if (!reader) {
        set.status = 404;
        return error(404, "未找到 Reader");
      }

      return success(reader);
    } catch (err) {
      console.error("Error fetching reader by ID:", err);
      set.status = 500;
      return error(500, "获取 reader 失败");
    }
  });
