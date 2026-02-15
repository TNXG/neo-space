/**
 * 缓存管理模块
 * 提供内存缓存功能，支持 TTL（Time To Live）
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null; // null 表示永不过期
}

export class Cache {
  private store: Map<string, CacheEntry<any>>;
  private cleanupInterval: Timer | null;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值，如果不存在或已过期则返回 null
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒），不传则永不过期
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;

    this.store.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * 删除缓存值
   * @param key 缓存键
   * @returns 是否成功删除
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 获取缓存大小
   * @returns 缓存条目数量
   */
  size(): number {
    return this.store.size;
  }

  /**
   * 获取所有缓存键
   * @returns 缓存键数组
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * 启动定期清理过期缓存
   * 每 60 秒清理一次
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 60 秒
  }

  /**
   * 清理过期的缓存条目
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Cache] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  /**
   * 停止清理定时器
   * 用于测试或应用关闭时
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取或设置缓存（如果不存在）
   * @param key 缓存键
   * @param factory 生成缓存值的工厂函数
   * @param ttl 过期时间（秒）
   * @returns 缓存值
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}

// 导出单例实例
export const cache = new Cache();
