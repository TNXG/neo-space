import { Elysia } from "elysia";
import { avatarRoutes } from "./avatar";
import { bindRoutes } from "./bind";
import { oauthRoutes } from "./oauth";
import { userRoutes } from "./user";

/**
 * Auth 路由主入口
 *
 * 整合所有认证相关的子路由：
 * - /auth/avatar - 头像管理
 * - /auth/oauth - OAuth 登录
 * - /auth/me - 当前用户信息
 * - /auth/accounts - 账号列表
 * - /auth/bind-anonymous - 绑定匿名身份
 * - /auth/skip-bind - 跳过绑定
 * - /auth/bindable-identities - 可绑定身份列表
 */
export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(avatarRoutes)
  .use(oauthRoutes)
  .use(userRoutes)
  .use(bindRoutes);
