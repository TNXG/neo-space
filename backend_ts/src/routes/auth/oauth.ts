import { Elysia, t } from "elysia";
import { getConfig } from "@/config";
import { db_read } from "@/lib/db";
import { responsePlugin } from "@/plugins/response";
import { convertToPayload, IdentityService } from "@/services/identity";
import { OAuthService } from "@/services/oauth";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";

/**
 * OAuth 认证路由
 *
 * GET /oauth/:provider - 发起 OAuth 登录（重定向到 OAuth provider）
 * GET /oauth/:provider/callback - OAuth 回调处理
 *
 * 支持的 providers: github, qq
 */
export const oauthRoutes = new Elysia()
  .use(responsePlugin())

  // GET /oauth/:provider - 发起 OAuth 登录
  .get(
    "/oauth/:provider",
    async ({ params, error, set }) => {
      const { provider } = params;

      // 验证 provider
      const supportedProviders = ["github", "qq"];
      if (!supportedProviders.includes(provider.toLowerCase())) {
        set.status = 400;
        return error(400, `Unsupported OAuth provider: ${provider}`);
      }

      // TODO: 从数据库读取 OAuth 配置（优先级高于环境变量）
      // const dbOAuthConfig = await getOAuthConfigFromDB();

      let redirectUrl: string;

      switch (provider.toLowerCase()) {
        case "github": {
          const clientId = config.oauth?.github?.clientId || process.env.GITHUB_CLIENT_ID;
          const redirectUri = config.oauth?.github?.redirectUri || process.env.GITHUB_REDIRECT_URI;

          if (!clientId) {
            set.status = 500;
            return error(500, "GitHub OAuth not configured");
          }

          redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || "")}&scope=user:email`;
          break;
        }

        case "qq": {
          const redirectUri = config.oauth?.qq?.redirectUri || process.env.QQ_REDIRECT_URI;
          // QQ OAuth 使用统一的服务
          redirectUrl = `https://api-space.tnxg.top/oauth/qq/authorize?redirect=true&return_url=${encodeURIComponent(redirectUri || "")}`;
          break;
        }

        default:
          set.status = 400;
          return error(400, `Unsupported provider: ${provider}`);
      }

      // 重定向到 OAuth provider
      set.redirect = redirectUrl;
    },
  )

  // GET /oauth/:provider/callback - OAuth 回调
  .get(
    "/oauth/:provider/callback",
    async ({ params: { provider: _provider }, query, set, cookie }) => {
      const { code } = query;
      const provider = _provider.toLowerCase();

      // 验证参数
      if (!code) {
        // 重定向到前端并带上错误信息
        const frontendUrl = config.server?.frontendUrl || "http://localhost:3000";
        const errorMsg = encodeURIComponent("Missing authorization code");
        set.redirect = `${frontendUrl}/auth/callback?error=${errorMsg}`;
        return;
      }

      try {
        // 1. 获取数据库中的 OAuth 配置（优先级高于环境变量）
        const dbOAuthOptions = await db_read(DB_NAME, "options", { key: "oauth" }, {});
        const dbOAuth = dbOAuthOptions[0]?.value || {};

        // 2. 获取第三方用户信息
        let userInfo;

        if (provider === "github") {
          const clientId = dbOAuth.github_client_id || config.oauth?.github?.clientId || process.env.GITHUB_CLIENT_ID;
          const clientSecret = dbOAuth.github_client_secret || config.oauth?.github?.clientSecret || process.env.GITHUB_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            throw new Error("GitHub 配置缺失");
          }

          const oauthService = new OAuthService(clientId, clientSecret, undefined);
          userInfo = await oauthService.exchangeGitHubCode(code);
        } else if (provider === "qq") {
          const redirectUri = config.oauth?.qq?.redirectUri || process.env.QQ_REDIRECT_URI;
          const oauthService = new OAuthService(undefined, undefined, redirectUri);
          userInfo = await oauthService.exchangeQQCode(code);
        } else {
          throw new Error("不支持的提供商");
        }

        // 3. 转换为标准 Payload
        const payload = convertToPayload(userInfo);

        // 4. 使用 IdentityService 处理复杂的业务逻辑
        const identityService = new IdentityService();
        const [userId, isOwner, isNewUser] = await identityService.processOAuthLogin(payload);

        // 5. 颁发 JWT 令牌
        const token = await identityService.issueToken(userId, isOwner);

        // 6. 设置 HttpOnly Cookie（用于后端 API 鉴权）
        cookie.auth_token.set({
          value: token,
          httpOnly: true,
          secure: true, // 生产环境强制 HTTPS
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60, // 7 天
        });

        // 7. 重定向回前端页面
        const frontendUrl = config.server?.frontendUrl || "http://localhost:3000";
        const callbackUrl = `${frontendUrl}/auth/callback?token=${token}&new_user=${isNewUser}`;
        set.redirect = callbackUrl;
      } catch (error) {
        // 如果处理失败，重定向到前端并带上错误参数
        const frontendUrl = config.server?.frontendUrl || "http://localhost:3000";
        const errorMsg = error instanceof Error ? error.message : "OAuth 处理失败";
        set.redirect = `${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMsg)}`;
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
      }),
    },
  );
