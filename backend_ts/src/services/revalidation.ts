/**
 * ISR 缓存刷新服务 - Next.js 增量静态再生成缓存失效通知
 * 对标 Rust backend 的 RevalidationService
 */

import crypto from "node:crypto";

export class RevalidationService {
  private nextjsUrl: string;
  private secret: string;
  private salt: string;

  constructor(nextjsUrl: string, secret: string, salt: string) {
    this.nextjsUrl = nextjsUrl;
    this.secret = secret;
    this.salt = salt;
  }

  /**
   * 生成 HMAC 签名
   */
  private generateSignature(data: string): string {
    const hmac = crypto.createHmac("sha256", this.secret);
    hmac.update(data + this.salt);
    return hmac.digest("hex");
  }

  /**
   * 重新验证标签
   */
  async revalidateTag(tag: string): Promise<void> {
    try {
      const url = `${this.nextjsUrl}/api/revalidate`;
      const body = JSON.stringify({ tag });
      const signature = this.generateSignature(body);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Revalidate-Signature": signature,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log(`[Revalidation] ✓ 标签重新验证成功: ${tag}`);
    } catch (error) {
      console.error(`[Revalidation] 标签重新验证失败: ${tag}`, error);
      throw error;
    }
  }

  /**
   * 重新验证路径
   */
  async revalidatePath(path: string): Promise<void> {
    try {
      const url = `${this.nextjsUrl}/api/revalidate`;
      const body = JSON.stringify({ path });
      const signature = this.generateSignature(body);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Revalidate-Signature": signature,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log(`[Revalidation] ✓ 路径重新验证成功: ${path}`);
    } catch (error) {
      console.error(`[Revalidation] 路径重新验证失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 同时重新验证标签和路径
   */
  async revalidateBoth(tag: string, path: string): Promise<void> {
    await Promise.all([this.revalidateTag(tag), this.revalidatePath(path)]);
  }
}

// 单例实例
let revalidationServiceInstance: RevalidationService | null = null;

export function getRevalidationService(): RevalidationService | null {
  if (revalidationServiceInstance) {
    return revalidationServiceInstance;
  }

  const nextjsUrl = process.env.NEXTJS_URL || "http://localhost:3000";
  const secret = process.env.REVALIDATION_SECRET;
  const salt = process.env.REVALIDATION_SALT || "default-salt";

  if (!secret) {
    console.warn("[Revalidation] REVALIDATION_SECRET 未配置，ISR 缓存刷新服务未启用");
    return null;
  }

  revalidationServiceInstance = new RevalidationService(nextjsUrl, secret, salt);
  console.log("[Revalidation] ✓ ISR 缓存刷新服务已启用");

  return revalidationServiceInstance;
}
