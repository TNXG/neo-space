/**
 * 身份服务
 *
 * 处理 OAuth 登录、账号关联、临时账户等复杂的业务逻辑
 */

import type { OAuthUserInfo } from "./oauth";
import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_count, db_insert, db_read, db_update } from "@/lib/db";
import { generateToken, jwtPlugin } from "@/middleware/auth";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";

/**
 * OAuth 用户 Payload
 */
export interface OAuthUserPayload {
  provider: string;
  providerId: string;
  name: string;
  email?: string;
  avatar?: string;
  handle?: string;
  accessToken: string;
  scope?: string;
}

/**
 * 身份服务
 */
export class IdentityService {
  private jwtInstance: any;

  constructor() {
    // 创建 JWT 实例
    const jwtApp = new Elysia().use(jwtPlugin());
    this.jwtInstance = (jwtApp as any).decorator.jwt;
  }

  /**
   * 处理通用的 OAuth 登录流逻辑
   *
   * @param payload - OAuth 用户信息
   * @returns [userId, isOwner, isNewUser]
   */
  async processOAuthLogin(
    payload: OAuthUserPayload,
  ): Promise<[ObjectId, boolean, boolean]> {
    // 1. 查找现有账号
    const existingAccounts = await db_read(
      DB_NAME,
      "accounts",
      {
        provider: payload.provider,
        accountId: payload.providerId,
      },
      {},
    );

    if (existingAccounts.length > 0) {
      const account = existingAccounts[0];
      // 查找关联的 Reader
      const readers = await db_read(
        DB_NAME,
        "readers",
        { _id: new ObjectId(account.userId) },
        {},
      );

      if (readers.length > 0) {
        const reader = readers[0];
        return [new ObjectId(reader._id), reader.isOwner || false, false];
      }

      throw new Error("账户数据不一致");
    }

    // 2. 新用户：尝试通过邮箱自动匹配
    if (payload.email) {
      const matchedReaders = await db_read(
        DB_NAME,
        "readers",
        { email: payload.email },
        {},
      );

      if (matchedReaders.length > 0) {
        const matchedReader = matchedReaders[0];
        // 自动绑定到已有 Reader
        await this.createAccountRecord(new ObjectId(matchedReader._id), payload);
        return [new ObjectId(matchedReader._id), matchedReader.isOwner || false, false];
      }
    }

    // 3. 彻底的新用户：检查是否是系统第一个用户
    const readerCount = await db_count(DB_NAME, "readers", {});
    const isFirst = readerCount === 0;
    const tempId = new ObjectId();

    await this.createAccountRecord(tempId, payload);

    return [tempId, isFirst, true];
  }

  /**
   * 创建 Account 记录
   */
  private async createAccountRecord(
    userId: ObjectId,
    payload: OAuthUserPayload,
  ): Promise<void> {
    const now = new Date();

    const account: any = {
      userId,
      provider: payload.provider,
      accountId: payload.providerId,
      accessToken: payload.accessToken,
      scope: payload.scope || null,
      oauthName: payload.name,
      oauthEmail: payload.email || null,
      oauthAvatar: payload.avatar || "",
      oauthHandle: payload.handle || (payload.provider === "github" ? "user" : ""),
      createdAt: now,
      updatedAt: now,
    };

    await db_insert(DB_NAME, "accounts", account);
  }

  /**
   * 合并身份（将一个用户的所有账号转移到另一个用户）
   */
  async mergeIdentities(fromId: ObjectId, toId: ObjectId): Promise<void> {
    const accounts = await db_read(
      DB_NAME,
      "accounts",
      { userId: fromId },
      {},
    );

    for (const account of accounts) {
      await db_update(
        DB_NAME,
        "accounts",
        { _id: new ObjectId(account._id) },
        { userId: toId },
      );
    }
  }

  /**
   * 颁发 JWT token（与 Rust 后端一致）
   */
  async issueToken(userId: ObjectId, isOwner: boolean): Promise<string> {
    return generateToken(this.jwtInstance, userId.toHexString(), isOwner);
  }
}

/**
 * 将 OAuthUserInfo 转换为 OAuthUserPayload
 */
export function convertToPayload(info: OAuthUserInfo): OAuthUserPayload {
  return {
    provider: info.provider,
    providerId: info.providerId,
    name: info.nickname,
    email: info.email,
    avatar: info.avatar,
    handle: undefined,
    accessToken: info.accessToken || "",
    scope: undefined,
  };
}
