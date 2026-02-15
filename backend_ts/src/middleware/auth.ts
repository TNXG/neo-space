/**
 * 认证中间件
 * 处理 JWT token 验证和用户认证
 *
 * JWT Claims 结构（与 Rust 后端一致）:
 * - sub: user_id (ObjectId as hex string)
 * - isOwner: boolean
 * - exp: expiration time (Unix timestamp)
 * - iat: issued at (Unix timestamp)
 */

import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { getConfig } from "@/config";

// JWT Payload 接口（扩展版本，包含更多用户信息）
export interface JWTPayload {
  sub: string; // user_id (ObjectId as hex string) - 兼容 Rust 后端
  userId?: string; // 别名，方便使用
  email?: string; // 用户邮箱
  role?: string; // 用户角色（user/admin）
  isOwner: boolean; // 是否是站长
  iat?: number; // issued at
  exp?: number; // expiration
}

/**
 * JWT 插件
 * 提供 JWT 签名和验证功能
 */
export const jwtPlugin = () => {
  const config = getConfig();

  return new Elysia({ name: "jwt" }).use(
    jwt({
      name: "jwt",
      secret: config.jwt.secret,
    }),
  );
};

/**
 * 认证中间件
 * 解析 Authorization header 或 Cookie 中的 JWT token 并验证
 * 将用户信息注入到 context 中
 */
export const authMiddleware = () => {
  return (app: Elysia) =>
    app.use(jwtPlugin()).derive(async ({ headers, cookie, jwt }) => {
      // 1. 优先从 Authorization header 中提取 token
      let token: string | undefined;
      const authHeader = headers.authorization;

      if (authHeader) {
        // 支持 "Bearer <token>" 格式
        token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : authHeader;
      }

      // 2. 如果 header 中没有，尝试从 Cookie 中获取
      if (!token && cookie.auth_token) {
        token = cookie.auth_token.value as string | undefined;
      }

      if (!token) {
        return {
          user: null as { userId: string; email?: string; role?: string; isOwner: boolean } | null,
        };
      }

      try {
        // 验证 token
        const payload = await jwt.verify(token);

        if (!payload || !payload.sub) {
          return {
            user: null as { userId: string; email?: string; role?: string; isOwner: boolean } | null,
          };
        }

        // 返回用户信息（支持扩展字段）
        return {
          user: {
            userId: String(payload.sub || payload.userId),
            email: payload.email,
            role: payload.role || (payload.isOwner ? "admin" : "user"),
            isOwner: Boolean(payload.isOwner),
          },
        };
      } catch (error) {
        // Token 验证失败（过期、无效等）
        console.error("JWT verification failed:", error);
        return {
          user: null as { userId: string; email?: string; role?: string; isOwner: boolean } | null,
        };
      }
    });
};

/**
 * 要求认证的中间件
 * 如果用户未认证，返回 401 错误
 */
export const requireAuth = () => {
  return (app: Elysia) =>
    app.use(authMiddleware()).onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return {
          code: 401,
          status: "failed",
          message: "Authentication required",
          data: null,
        };
      }
    });
};

/**
 * 要求站长权限的中间件
 * 如果用户未认证或不是站长，返回 403 错误
 */
export const requireOwner = () => {
  return (app: Elysia) =>
    app.use(authMiddleware()).onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return {
          code: 401,
          status: "failed",
          message: "Authentication required",
          data: null,
        };
      }

      if (!user.isOwner) {
        set.status = 403;
        return {
          code: 403,
          status: "failed",
          message: "Owner access required",
          data: null,
        };
      }
    });
};

/**
 * 要求管理员权限的中间件
 * 如果用户未认证或不是管理员，返回 403 错误
 */
export const requireAdmin = () => {
  return (app: Elysia) =>
    app.use(authMiddleware()).onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return {
          code: 401,
          status: "failed",
          message: "Authentication required",
          data: null,
        };
      }

      if (user.role !== "admin" && !user.isOwner) {
        set.status = 403;
        return {
          code: 403,
          status: "failed",
          message: "Admin access required",
          data: null,
        };
      }
    });
};

/**
 * 生成 JWT token（支持扩展字段）
 * 用于登录成功后生成 token
 *
 * @param jwtInstance - JWT 实例
 * @param payload - 用户信息（支持两种格式）
 * @returns JWT token 字符串
 */
export async function generateToken(
  jwtInstance: any,
  payload: string | { userId: string; email?: string; role?: string; isOwner?: boolean },
  isOwner?: boolean,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 24 * 60 * 60; // 7 天后过期

  let jwtPayload: JWTPayload;

  // 支持两种调用方式：
  // 1. generateToken(jwt, userId, isOwner) - 兼容旧版本
  // 2. generateToken(jwt, { userId, email, role, isOwner }) - 新版本
  if (typeof payload === "string") {
    jwtPayload = {
      sub: payload,
      userId: payload,
      isOwner: isOwner || false,
      iat: now,
      exp,
    };
  } else {
    jwtPayload = {
      sub: payload.userId,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      isOwner: payload.isOwner || false,
      iat: now,
      exp,
    };
  }

  return await jwtInstance.sign(jwtPayload);
}
