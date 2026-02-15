import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_findById, db_read } from "@/lib/db";
import { authMiddleware } from "@/middleware/auth";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";

/**
 * 用户信息路由
 *
 * GET /me - 获取当前用户信息
 * GET /accounts - 获取关联的 OAuth 账号列表
 */
export const userRoutes = new Elysia()
  .use(responsePlugin())
  .use(authMiddleware())

  // GET /me - 获取当前用户信息
  .get("/me", async ({ user, success, error, set }) => {
    try {
      // 验证认证
      if (!user) {
        set.status = 401;
        return error(401, "Authentication required");
      }

      // 1. 尝试获取真实 Reader
      const reader = await db_findById(DB_NAME, "readers", user.userId);
      if (reader) {
        return success({
          id: reader._id,
          email: reader.email,
          name: reader.name,
          handle: reader.handle,
          image: reader.image,
          is_owner: reader.isOwner || false,
          email_verified: reader.emailVerified || false,
          created_at: reader.createdAt,
          updated_at: reader.updatedAt,
        });
      }

      // 2. 否则获取 Account 信息作为临时身份（新用户尚未创建 Reader）
      const accounts = await db_read(
        DB_NAME,
        "accounts",
        { userId: new ObjectId(user.userId) },
        {},
      );

      if (accounts.length > 0) {
        const account = accounts[0];
        // 从 Account 构造临时 Reader 响应（与 Rust 的 From<&Account> for ReaderResponse 一致）
        const tempReader = {
          id: account.userId,
          email: account.oauthEmail || "",
          name: account.oauthName || "新用户",
          handle: account.oauthHandle || "",
          image: account.oauthAvatar || "",
          is_owner: user.isOwner || false, // 由 AuthGuard 覆盖
          email_verified: false,
          created_at: account.createdAt,
          updated_at: account.updatedAt,
        };
        return success(tempReader);
      }

      set.status = 404;
      return error(404, "User not found");
    } catch (err) {
      console.error("Error fetching current user:", err);
      set.status = 500;
      return error(500, "Failed to fetch user information");
    }
  })

  // GET /accounts - 获取关联的 OAuth 账号列表
  .get("/accounts", async ({ user, success, error, set }) => {
    try {
      // 验证认证
      if (!user) {
        set.status = 401;
        return error(401, "Authentication required");
      }

      // 查询所有关联的 OAuth 账号
      const accounts = await db_read(
        DB_NAME,
        "accounts",
        { userId: new ObjectId(user.userId) },
        {},
      );

      // 转换为响应格式（AccountResponse - 不包含敏感的 OAuth 信息）
      const accountResponses = accounts.map((account: any) => ({
        id: account._id,
        userId: account.userId,
        provider: account.provider,
        accountId: account.accountId,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }));

      return success(accountResponses);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      set.status = 500;
      return error(500, "Failed to fetch accounts");
    }
  });
