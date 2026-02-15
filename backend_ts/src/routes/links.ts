import type { Link } from "@/types/models";
import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_count, db_findById, db_insert, db_read } from "@/lib/db";
import { paginationPlugin } from "@/plugins/pagination";
import { responsePlugin } from "@/plugins/response";
import { generateVerificationCode, sendVerificationCode } from "@/services/email";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "links";

/**
 * Links 路由处理器
 *
 * 提供以下端点：
 * - GET /links - 获取友链列表（仅返回已批准的友链）
 * - GET /links/:id - 根据 ID 获取友链详情
 * - POST /links/apply - 申请友链
 * - POST /links/verify - 发送验证码
 */
export const linksRoutes = new Elysia({ prefix: "/links" })
  .use(paginationPlugin())
  .use(responsePlugin())

  // GET /links - 列表（仅返回 status='approved' 的友链）
  .get(
    "/",
    async ({ pagination, createPaginationMeta, paginated, error, set }) => {
      const { _page, size, skip } = pagination;

      try {
        // 只返回已批准的友链
        const filter = { status: "approved" };

        // 查询数据
        const [links, total] = await Promise.all([
          db_read(DB_NAME, COLLECTION, filter, { skip, limit: size, sort: { created: -1 } }),
          db_count(DB_NAME, COLLECTION, filter),
        ]);

        return paginated(links, createPaginationMeta(total));
      } catch (err) {
        console.error("Error fetching links:", err);
        set.status = 500;
        return error(500, "Failed to fetch links");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        size: t.Optional(t.String()),
      }),
    },
  )

  // GET /links/:id - 根据 ID 获取
  .get("/:id", async ({ params, success, error, set }) => {
    try {
      // 验证 ID 格式
      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid link ID format");
      }

      const link = await db_findById(DB_NAME, COLLECTION, params.id);

      if (!link) {
        set.status = 404;
        return error(404, "Link not found");
      }

      return success(link);
    } catch (err) {
      console.error("Error fetching link by ID:", err);
      set.status = 500;
      return error(500, "Failed to fetch link");
    }
  })

  // POST /links/apply - 申请友链
  .post(
    "/apply",
    async ({ body, success, error, set }) => {
      try {
        // 验证必填字段
        const { name, url, avatar, description, email } = body;

        if (!name || !url || !avatar || !description || !email) {
          set.status = 400;
          return error(400, "Missing required fields: name, url, avatar, description, email");
        }

        // 验证 URL 格式
        try {
          // eslint-disable-next-line no-new
          new URL(url);
        } catch {
          set.status = 400;
          return error(400, "Invalid URL format");
        }

        // 验证邮箱格式（简单验证）
        const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          set.status = 400;
          return error(400, "Invalid email format");
        }

        // 创建友链申请
        const linkData: Partial<Link> = {
          name: name.trim(),
          url: url.trim(),
          avatar: avatar.trim(),
          description: description.trim(),
          email: email.trim(),
          status: "pending",
          created: new Date(),
        };

        const inserted = await db_insert(DB_NAME, COLLECTION, linkData);

        if (!inserted) {
          set.status = 500;
          return error(500, "Failed to create link application");
        }

        console.log(`[Links] New link application: ${name} (${url})`);

        set.status = 201;
        return success(
          { message: "Link application submitted successfully" },
          201,
        );
      } catch (err) {
        console.error("Error creating link application:", err);
        set.status = 500;
        return error(500, "Failed to create link application");
      }
    },
    {
      body: t.Object({
        name: t.String(),
        url: t.String(),
        avatar: t.String(),
        description: t.String(),
        email: t.String(),
      }),
    },
  )

  // POST /links/verify - 发送验证码
  .post(
    "/verify",
    async ({ body, success, error, set }) => {
      try {
        const { email } = body;

        if (!email) {
          set.status = 400;
          return error(400, "Email is required");
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          set.status = 400;
          return error(400, "Invalid email format");
        }

        // 生成验证码
        const code = generateVerificationCode();

        // 发送验证码邮件
        const sent = await sendVerificationCode(email, code);

        if (!sent) {
          set.status = 500;
          return error(500, "Failed to send verification code");
        }

        console.log(`[Links] Verification code sent to ${email}`);

        return success({
          message: "Verification code sent successfully",
          // 注意：实际生产环境中不应该返回验证码，这里仅用于开发测试
          code: process.env.NODE_ENV === "development" ? code : undefined,
        });
      } catch (err) {
        console.error("Error sending verification code:", err);
        set.status = 500;
        return error(500, "Failed to send verification code");
      }
    },
    {
      body: t.Object({
        email: t.String(),
      }),
    },
  );
