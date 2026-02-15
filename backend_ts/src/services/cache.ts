/**
 * 缓存服务 - 使用 Redis 替代简单内存缓存
 * 对标 Rust backend 的 CacheService (Moka)
 */

import Redis from "ioredis";
import { getConfig } from "@/config";

export enum CacheKey {
  Post = "post",
  PostList = "posts",
  Note = "note",
  NoteList = "notes",
  Page = "page",
  Link = "link",
  Categories = "categories",
  LinkHealth = "link_health",
}

export class CacheService {
  private redis: Redis;
  private defaultTTL: number;

  constructor(redis?: Redis, ttlSeconds = 3600) {
    this.redis = redis || this.createRedisClient();
    this.defaultTTL = ttlSeconds;
  }

  private createRedisClient(): Redis {
    const config = getConfig();
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    return new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("Redis 连接失败，超过最大重试次数");
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });
  }

  /**
   * 生成缓存键
   */
  private buildKey(type: CacheKey, id?: string, params?: Record<string, any>): string {
    if (id) {
      return `${type}:${id}`;
    }
    if (params) {
      const paramStr = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(":");
      return `${type}:${paramStr}`;
    }
    return type;
  }

  /**
   * 获取缓存
   */
  async get<T>(type: CacheKey, id?: string, params?: Record<string, any>): Promise<T | null> {
    try {
      const key = this.buildKey(type, id, params);
      const value = await this.redis.get(key);

      if (value) {
        console.log(`[Cache] ✓ 命中缓存: ${key}`);
        return JSON.parse(value) as T;
      }

      console.log(`[Cache] 未命中: ${key}`);
      return null;
    } catch (error) {
      console.error(`[Cache] 获取失败:`, error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(
    type: CacheKey,
    value: T,
    id?: string,
    params?: Record<string, any>,
    ttl?: number,
  ): Promise<void> {
    try {
      const key = this.buildKey(type, id, params);
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      await this.redis.setex(key, expiry, serialized);
      console.log(`[Cache] 写入缓存: ${key} (TTL: ${expiry}s, ${serialized.length} bytes)`);
    } catch (error) {
      console.error(`[Cache] 写入失败:`, error);
    }
  }

  /**
   * 删除单个缓存
   */
  async invalidate(type: CacheKey, id?: string, params?: Record<string, any>): Promise<void> {
    try {
      const key = this.buildKey(type, id, params);
      await this.redis.del(key);
      console.log(`[Cache] 清除缓存: ${key}`);
    } catch (error) {
      console.error(`[Cache] 清除失败:`, error);
    }
  }

  /**
   * 批量删除缓存（通过前缀匹配）
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      console.log(`[Cache] 批量清除缓存 (前缀: ${prefix})`);

      const stream = this.redis.scanStream({
        match: `${prefix}*`,
        count: 100,
      });

      const keys: string[] = [];
      stream.on("data", (resultKeys: string[]) => {
        keys.push(...resultKeys);
      });

      await new Promise<void>((resolve, reject) => {
        stream.on("end", () => resolve());
        stream.on("error", err => reject(err));
      });

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`[Cache] 已清除 ${keys.length} 个缓存键`);
      }
    } catch (error) {
      console.error(`[Cache] 批量清除失败:`, error);
    }
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
      console.warn("[Cache] 清除所有缓存");
    } catch (error) {
      console.error(`[Cache] 清除所有缓存失败:`, error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async stats(): Promise<{ keyCount: number; memoryUsed: string }> {
    try {
      const dbSize = await this.redis.dbsize();
      const info = await this.redis.info("memory");
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1].trim() : "unknown";

      return {
        keyCount: dbSize,
        memoryUsed,
      };
    } catch (error) {
      console.error(`[Cache] 获取统计信息失败:`, error);
      return { keyCount: 0, memoryUsed: "unknown" };
    }
  }

  /**
   * 关闭 Redis 连接
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * 连接 Redis
   */
  async connect(): Promise<void> {
    if (this.redis.status === "ready") {
      return;
    }
    await this.redis.connect();
    console.log("✓ Redis 连接成功");
  }
}

// 单例实例
let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}
