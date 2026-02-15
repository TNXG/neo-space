/**
 * Owner 守卫中间件 - 验证用户是否为站长
 * 对标 Rust backend 的 OwnerGuard
 */

import { Elysia } from "elysia";
import { verifyJWT } from "@/lib/utils";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export interface OwnerContext {
  userId: ObjectId;
  isOwner: true;
}

/**
 * Owner 守卫插件
 * 确保用户已认证且为 Owner
 */
export const ownerGuard = () =>
  new Elysia({ name: "owner-guard" })
    .derive(async ({ headers, error }) => {
      // 1. 从 Authorization header 获取 JWT token
      const authorization = headers.authorization;
      if (!authorization || !authorization.startsWith("Bearer ")) {
        return error(401, {
          code: 401,
          message: "缺少认证信息",
        });
      }

      const token = authorization.slice(7);

      // 2. 验证 JWT token
      let payload: any;
      try {
        payload = await verifyJWT(token);
      } catch (err) {
        return error(401, {
          code: 401,
          message: "认证令牌无效或已过期",
        });
      }

      // 3. 检查是否为 Owner
      if (!payload.isOwner) {
        console.warn(`用户 ${payload.userId} 尝试访问 Owner 专属 API，但不是 Owner`);
        return error(403, {
          code: 403,
          message: "权限不足",
        });
      }

      // 4. 验证用户是否存在
      const db = await getDb();
      const user = await db.collection("users").findOne({
        _id: new ObjectId(payload.userId),
      });

      if (!user) {
        return error(401, {
          code: 401,
          message: "用户不存在",
        });
      }

      console.log(`Owner 验证成功: userId=${payload.userId}`);

      return {
        owner: {
          userId: new ObjectId(payload.userId),
          isOwner: true as const,
        } as OwnerContext,
      };
    })
    .as("plugin");

/**
 * 可选 Owner 守卫
 * 如果有 token 且为 Owner 则验证，否则返回 null
 */
export const optionalOwnerGuard = () =>
  new Elysia({ name: "optional-owner-guard" })
    .derive(async ({ headers }) => {
      const authorization = headers.authorization;
      if (!authorization || !authorization.startsWith("Bearer ")) {
        return { owner: null };
      }

      const token = authorization.slice(7);

      try {
        const payload = await verifyJWT(token);

        if (!payload.isOwner) {
          return { owner: null };
        }

        const db = await getDb();
        const user = await db.collection("users").findOne({
          _id: new ObjectId(payload.userId),
        });

        if (!user) {
          return { owner: null };
        }

        return {
          owner: {
            userId: new ObjectId(payload.userId),
            isOwner: true as const,
          } as OwnerContext,
        };
      } catch {
        return { owner: null };
      }
    })
    .as("plugin");
