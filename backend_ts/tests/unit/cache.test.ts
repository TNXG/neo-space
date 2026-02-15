import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cache } from "@/lib/cache";

describe("Cache", () => {
  beforeEach(() => {
    cache.clear();
  });

  afterEach(() => {
    cache.clear();
  });

  describe("基本功能", () => {
    it("应该能够设置和获取缓存", () => {
      cache.set("test-key", "test-value");
      const value = cache.get("test-key");
      expect(value).toBe("test-value");
    });

    it("应该能够存储不同类型的数据", () => {
      cache.set("string", "hello");
      cache.set("number", 42);
      cache.set("object", { foo: "bar" });
      cache.set("array", [1, 2, 3]);

      expect(cache.get("string")).toBe("hello");
      expect(cache.get("number")).toBe(42);
      expect(cache.get("object")).toEqual({ foo: "bar" });
      expect(cache.get("array")).toEqual([1, 2, 3]);
    });

    it("应该在键不存在时返回 null", () => {
      const value = cache.get("non-existent");
      expect(value).toBeNull();
    });

    it("应该能够删除缓存", () => {
      cache.set("test-key", "test-value");
      expect(cache.get("test-key")).toBe("test-value");

      const deleted = cache.delete("test-key");
      expect(deleted).toBe(true);
      expect(cache.get("test-key")).toBeNull();
    });

    it("应该在删除不存在的键时返回 false", () => {
      const deleted = cache.delete("non-existent");
      expect(deleted).toBe(false);
    });

    it("应该能够清空所有缓存", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      expect(cache.size()).toBe(3);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBeNull();
      expect(cache.get("key3")).toBeNull();
    });
  });

  describe("TTL 功能", () => {
    it("应该在 TTL 过期后返回 null", async () => {
      // 设置 1 秒 TTL
      cache.set("test-key", "test-value", 1);
      expect(cache.get("test-key")).toBe("test-value");

      // 等待 1.1 秒
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 缓存应该已过期
      expect(cache.get("test-key")).toBeNull();
    });

    it("应该在 TTL 未过期时返回值", async () => {
      // 设置 2 秒 TTL
      cache.set("test-key", "test-value", 2);
      expect(cache.get("test-key")).toBe("test-value");

      // 等待 0.5 秒
      await new Promise(resolve => setTimeout(resolve, 500));

      // 缓存应该仍然有效
      expect(cache.get("test-key")).toBe("test-value");
    });

    it("应该支持不设置 TTL（永不过期）", async () => {
      cache.set("test-key", "test-value");
      expect(cache.get("test-key")).toBe("test-value");

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 100));

      // 缓存应该仍然有效
      expect(cache.get("test-key")).toBe("test-value");
    });
  });

  describe("getOrSet 功能", () => {
    it("应该在缓存不存在时调用工厂函数", async () => {
      let factoryCalled = false;
      const factory = async () => {
        factoryCalled = true;
        return "generated-value";
      };

      const value = await cache.getOrSet("test-key", factory);
      expect(value).toBe("generated-value");
      expect(factoryCalled).toBe(true);
    });

    it("应该在缓存存在时不调用工厂函数", async () => {
      cache.set("test-key", "cached-value");

      let factoryCalled = false;
      const factory = async () => {
        factoryCalled = true;
        return "generated-value";
      };

      const value = await cache.getOrSet("test-key", factory);
      expect(value).toBe("cached-value");
      expect(factoryCalled).toBe(false);
    });

    it("应该在缓存过期后重新调用工厂函数", async () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return `value-${callCount}`;
      };

      // 第一次调用，设置 1 秒 TTL
      const value1 = await cache.getOrSet("test-key", factory, 1);
      expect(value1).toBe("value-1");
      expect(callCount).toBe(1);

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 第二次调用，应该重新生成
      const value2 = await cache.getOrSet("test-key", factory, 1);
      expect(value2).toBe("value-2");
      expect(callCount).toBe(2);
    });
  });

  describe("辅助方法", () => {
    it("has() 应该正确检查缓存是否存在", () => {
      expect(cache.has("test-key")).toBe(false);

      cache.set("test-key", "test-value");
      expect(cache.has("test-key")).toBe(true);

      cache.delete("test-key");
      expect(cache.has("test-key")).toBe(false);
    });

    it("size() 应该返回正确的缓存数量", () => {
      expect(cache.size()).toBe(0);

      cache.set("key1", "value1");
      expect(cache.size()).toBe(1);

      cache.set("key2", "value2");
      expect(cache.size()).toBe(2);

      cache.delete("key1");
      expect(cache.size()).toBe(1);

      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it("keys() 应该返回所有缓存键", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });
  });
});
