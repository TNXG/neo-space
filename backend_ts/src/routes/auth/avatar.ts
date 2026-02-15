import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_findById, db_read, db_update } from "@/lib/db";
import { authMiddleware } from "@/middleware/auth";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";

/**
 * 头像管理路由
 *
 * PUT /avatar - 更新头像（从 GitHub/QQ/Gravatar 获取）
 */
export const avatarRoutes = new Elysia()
  .use(responsePlugin())
  .use(authMiddleware())

  // PUT /avatar - 更新头像
  .put(
    "/avatar",
    async ({ body, user, success, error, set }) => {
      try {
        // 验证认证
        if (!user) {
          set.status = 401;
          return error(401, "Authentication required");
        }

        // 查询用户
        const reader = await db_findById(DB_NAME, "readers", user.userId);
        if (!reader) {
          set.status = 404;
          return error(404, "User not found");
        }

        let newAvatar: string;

        switch (body.provider) {
          case "gravatar": {
            // 使用 Gravatar (cravatar.cn)
            const email = reader.email || "";
            const hash = await computeMD5(email.toLowerCase().trim());
            newAvatar = `https://cravatar.cn/avatar/${hash}`;
            break;
          }

          case "github":
          case "qq": {
            // 从关联的 OAuth 账号获取头像
            const accounts = await db_read(
              DB_NAME,
              "accounts",
              { userId: new ObjectId(user.userId) },
              {},
            );

            const account = accounts.find((acc: any) => acc.provider === body.provider);
            if (!account || !account.oauthAvatar) {
              set.status = 404;
              return error(404, `No ${body.provider} account linked`);
            }

            newAvatar = account.oauthAvatar;
            break;
          }

          default:
            set.status = 400;
            return error(400, "Unsupported provider. Use: github, qq, or gravatar");
        }

        // 更新头像
        await db_update(
          DB_NAME,
          "readers",
          { _id: new ObjectId(user.userId) },
          { image: newAvatar },
        );

        // 返回更新后的用户信息
        const updatedReader = await db_findById(DB_NAME, "readers", user.userId);
        return success(updatedReader);
      } catch (err) {
        console.error("Error updating avatar:", err);
        set.status = 500;
        return error(500, "Failed to update avatar");
      }
    },
    {
      body: t.Object({
        provider: t.Union([t.Literal("github"), t.Literal("qq"), t.Literal("gravatar")]),
      }),
    },
  );

/**
 * 计算字符串的 MD5 哈希
 */
async function computeMD5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
