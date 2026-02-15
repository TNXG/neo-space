import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_delete, db_find, db_read, db_update } from "@/lib/db";
import { authMiddleware, generateToken, jwtPlugin } from "@/middleware/auth";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";

/**
 * Auth 绑定操作路由
 *
 * 提供以下端点：
 * - POST /auth/bind-anonymous - 绑定匿名身份
 * - POST /auth/skip-bind - 跳过绑定，创建新 Reader
 * - GET /auth/bindable-identities - 获取可绑定的身份列表
 */
export const bindRoutes = new Elysia()
  .use(authMiddleware())
  .use(jwtPlugin())

  // POST /auth/bind-anonymous - 绑定匿名身份
  .post(
    "/bind-anonymous",
    async ({ body, user, jwt, success, error, set }) => {
      try {
        if (!user) {
          set.status = 401;
          return error(401, "Authentication required");
        }

        // 查找匿名 Reader
        const anonReader = await db_find(DB_NAME, "readers", {
          name: body.name,
          mail: body.email,
        });

        if (!anonReader) {
          set.status = 404;
          return error(404, "未匹配到匿名身份");
        }

        // 迁移所有 Account（将临时用户的账号转移到匿名用户）
        await db_update(
          DB_NAME,
          "accounts",
          { userId: new ObjectId(user.userId) },
          { userId: anonReader._id },
        );

        // 删除临时的 Reader
        await db_delete(DB_NAME, "readers", { _id: new ObjectId(user.userId) });

        // 生成新 token
        const token = await generateToken(jwt, {
          userId: anonReader._id.toString(),
          email: anonReader.mail,
          role: anonReader.isOwner ? "admin" : "user",
          isOwner: anonReader.isOwner,
        });

        return success(
          {
            ...anonReader,
            token,
          },
          200,
        );
      } catch (err) {
        console.error("Error binding anonymous identity:", err);
        set.status = 500;
        return error(500, "Failed to bind anonymous identity");
      }
    },
    {
      body: t.Object({
        name: t.String(),
        email: t.String(),
      }),
    },
  )

  // POST /auth/skip-bind - 跳过绑定
  .post("/skip-bind", async ({ user, jwt, success, error, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return error(401, "Authentication required");
      }

      // 检查是否已经有 Reader
      const existingReader = await db_find(DB_NAME, "readers", {
        _id: new ObjectId(user.userId),
      });

      if (existingReader) {
        return success(existingReader);
      }

      // 从 Account 获取信息创建 Reader
      const accounts = await db_read(DB_NAME, "accounts", {
        userId: new ObjectId(user.userId),
      });

      if (!accounts || accounts.length === 0) {
        set.status = 404;
        return error(404, "未找到账号信息");
      }

      const account = accounts[0];

      // 检查是否是第一个用户（站长）
      const allReaders = await db_read(DB_NAME, "readers", {});
      const isFirst = allReaders.length === 0;

      // 创建新 Reader
      const newReader = {
        _id: new ObjectId(user.userId),
        mail: account.oauthEmail || "",
        name: account.oauthName || "用户",
        handle: account.oauthHandle || `user_${Date.now()}`,
        image: account.oauthAvatar || "",
        isOwner: isFirst,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 插入 Reader（使用 update with upsert）
      await db_update(DB_NAME, "readers", { _id: newReader._id }, newReader);

      // 生成新 token
      const token = await generateToken(jwt, {
        userId: newReader._id.toString(),
        email: newReader.mail,
        role: isFirst ? "admin" : "user",
        isOwner: isFirst,
      });

      return success({
        ...newReader,
        token,
      });
    } catch (err) {
      console.error("Error skipping bind:", err);
      set.status = 500;
      return error(500, "Failed to skip bind");
    }
  })

  // GET /auth/bindable-identities - 获取可绑定的身份列表
  .get("/bindable-identities", async ({ user, success, error, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return error(401, "Authentication required");
      }

      // 获取当前用户的所有账号
      const accounts = await db_read(DB_NAME, "accounts", {
        userId: new ObjectId(user.userId),
      });

      // 提取所有邮箱
      const emails = accounts
        .map((a: any) => a.oauthEmail)
        .filter((email: string) => email);

      if (emails.length === 0) {
        return success([]);
      }

      // 查找所有匹配邮箱的 Reader（排除当前用户）
      const allReaders = await db_read(DB_NAME, "readers", {});
      const bindableReaders = allReaders.filter(
        (r: any) =>
          r._id.toString() !== user.userId && emails.includes(r.mail),
      );

      return success(bindableReaders);
    } catch (err) {
      console.error("Error fetching bindable identities:", err);
      set.status = 500;
      return error(500, "Failed to fetch bindable identities");
    }
  });
