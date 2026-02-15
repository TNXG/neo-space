/**
 * 验证码服务 - 验证码生成、存储、验证
 * 对标 Rust backend 的 VerificationService
 */

import { getCacheService } from "./cache";

interface VerificationCode {
  code: string;
  attempts: number; // 剩余尝试次数
  createdAt: number;
}

export class VerificationService {
  private readonly TTL = 600; // 10 分钟过期
  private readonly MAX_ATTEMPTS = 3; // 最多 3 次尝试

  /**
   * 生成 6 位数字验证码
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 构建验证码缓存键
   */
  private buildKey(email: string): string {
    return `verification:${email.toLowerCase()}`;
  }

  /**
   * 发送验证码（生成并存储）
   */
  async sendCode(email: string): Promise<string> {
    const code = this.generateCode();
    const key = this.buildKey(email);
    const cache = getCacheService();

    const verification: VerificationCode = {
      code,
      attempts: this.MAX_ATTEMPTS,
      createdAt: Date.now(),
    };

    // 存储到 Redis，10 分钟过期
    await cache.set("verification" as any, verification, key, undefined, this.TTL);

    console.log(`[Verification] 生成验证码: ${email} -> ${code}`);
    return code;
  }

  /**
   * 验证验证码
   */
  async verifyCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
    const key = this.buildKey(email);
    const cache = getCacheService();

    const verification = await cache.get<VerificationCode>("verification" as any, key);

    if (!verification) {
      return {
        success: false,
        message: "验证码不存在或已过期",
      };
    }

    if (verification.attempts <= 0) {
      await cache.invalidate("verification" as any, key);
      return {
        success: false,
        message: "验证码尝试次数已用完",
      };
    }

    if (verification.code !== code) {
      verification.attempts -= 1;

      if (verification.attempts > 0) {
        // 更新剩余尝试次数
        await cache.set("verification" as any, verification, key, undefined, this.TTL);
        return {
          success: false,
          message: `验证码错误，还剩 ${verification.attempts} 次尝试机会`,
        };
      }

      // 尝试次数用完，删除验证码
      await cache.invalidate("verification" as any, key);
      return {
        success: false,
        message: "验证码错误，尝试次数已用完",
      };
    }

    // 验证成功，删除验证码
    await cache.invalidate("verification" as any, key);
    console.log(`[Verification] 验证成功: ${email}`);

    return {
      success: true,
      message: "验证成功",
    };
  }

  /**
   * 检查验证码是否存在（用于限制发送频率）
   */
  async hasCode(email: string): Promise<boolean> {
    const key = this.buildKey(email);
    const cache = getCacheService();
    const verification = await cache.get<VerificationCode>("verification" as any, key);
    return verification !== null;
  }

  /**
   * 获取验证码剩余时间（秒）
   */
  async getRemainingTime(email: string): Promise<number | null> {
    const key = this.buildKey(email);
    const cache = getCacheService();
    const verification = await cache.get<VerificationCode>("verification" as any, key);

    if (!verification) {
      return null;
    }

    const elapsed = Math.floor((Date.now() - verification.createdAt) / 1000);
    const remaining = this.TTL - elapsed;

    return remaining > 0 ? remaining : 0;
  }
}

// 单例实例
let verificationServiceInstance: VerificationService | null = null;

export function getVerificationService(): VerificationService {
  if (!verificationServiceInstance) {
    verificationServiceInstance = new VerificationService();
  }
  return verificationServiceInstance;
}
