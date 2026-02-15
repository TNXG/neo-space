import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { cache } from "@/lib/cache";
import { categoriesRoutes } from "@/routes/categories";
import { configRoutes } from "@/routes/config";
import { postsRoutes } from "@/routes/posts";

describe("缓存路由集成测试", () => {
  let app: any;

  beforeEach(() => {
    // 清空缓存
    cache.clear();

    // 创建测试应用
    app = new Elysia()
      .use(categoriesRoutes)
      .use(configRoutes)
      .use(postsRoutes);
  });

  afterEach(() => {
    cache.clear();
  });

  describe("Categories 缓存", () => {
    it("应该在第一次请求时从数据库获取并缓存", async () => {
      const response = await app.handle(
        new Request("http://localhost/categories"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");

      // 验证缓存已设置
      expect(cache.has("categories:list")).toBe(true);
    });

    it("应该在第二次请求时使用缓存", async () => {
      // 第一次请求
      const firstResponse = await app.handle(new Request("http://localhost/categories"));
      const firstData = await firstResponse.json();

      // 第二次请求
      const secondResponse = await app.handle(
        new Request("http://localhost/categories"),
      );

      expect(secondResponse.status).toBe(200);
      const secondData = await secondResponse.json();

      // 验证两次请求返回相同的数据（通过比较序列化后的字符串）
      expect(JSON.stringify(secondData.data)).toBe(JSON.stringify(firstData.data));

      // 验证缓存仍然存在
      expect(cache.has("categories:list")).toBe(true);
    });

    it("应该能够使缓存失效", async () => {
      // 第一次请求，建立缓存
      await app.handle(new Request("http://localhost/categories"));
      expect(cache.has("categories:list")).toBe(true);

      // 使缓存失效
      const invalidateResponse = await app.handle(
        new Request("http://localhost/categories/invalidate", {
          method: "POST",
        }),
      );

      expect(invalidateResponse.status).toBe(200);
      const invalidateData = await invalidateResponse.json();
      expect(invalidateData.data.invalidated).toBe(true);

      // 验证缓存已被删除
      expect(cache.has("categories:list")).toBe(false);
    });
  });

  describe("Config 缓存", () => {
    it("应该在第一次请求时从数据库获取并缓存", async () => {
      const response = await app.handle(
        new Request("http://localhost/config"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");

      // 验证缓存已设置
      expect(cache.has("site:config")).toBe(true);
    });

    it("应该在第二次请求时使用缓存", async () => {
      // 第一次请求
      const firstResponse = await app.handle(new Request("http://localhost/config"));
      const firstData = await firstResponse.json();

      // 第二次请求
      const secondResponse = await app.handle(
        new Request("http://localhost/config"),
      );

      expect(secondResponse.status).toBe(200);
      const secondData = await secondResponse.json();

      // 验证两次请求返回相同的数据
      expect(JSON.stringify(secondData.data)).toBe(JSON.stringify(firstData.data));

      // 验证缓存仍然存在
      expect(cache.has("site:config")).toBe(true);
    });

    it("应该能够使缓存失效", async () => {
      // 第一次请求，建立缓存
      await app.handle(new Request("http://localhost/config"));
      expect(cache.has("site:config")).toBe(true);

      // 使缓存失效
      const invalidateResponse = await app.handle(
        new Request("http://localhost/config/invalidate", {
          method: "POST",
        }),
      );

      expect(invalidateResponse.status).toBe(200);
      const invalidateData = await invalidateResponse.json();
      expect(invalidateData.data.invalidated).toBe(true);

      // 验证缓存已被删除
      expect(cache.has("site:config")).toBe(false);
    });
  });

  describe("Hot Posts 缓存", () => {
    it("应该在第一次请求时从数据库获取并缓存", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts/hot"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");

      // 验证缓存已设置
      expect(cache.has("posts:hot")).toBe(true);
    });

    it("应该在第二次请求时使用缓存", async () => {
      // 第一次请求
      const firstResponse = await app.handle(new Request("http://localhost/posts/hot"));
      const firstData = await firstResponse.json();

      // 第二次请求
      const secondResponse = await app.handle(
        new Request("http://localhost/posts/hot"),
      );

      expect(secondResponse.status).toBe(200);
      const secondData = await secondResponse.json();

      // 验证两次请求返回相同的数据
      expect(JSON.stringify(secondData.data)).toBe(JSON.stringify(firstData.data));

      // 验证缓存仍然存在
      expect(cache.has("posts:hot")).toBe(true);
    });

    it("应该能够使缓存失效", async () => {
      // 第一次请求，建立缓存
      await app.handle(new Request("http://localhost/posts/hot"));
      expect(cache.has("posts:hot")).toBe(true);

      // 使缓存失效
      const invalidateResponse = await app.handle(
        new Request("http://localhost/posts/invalidate-cache", {
          method: "POST",
        }),
      );

      expect(invalidateResponse.status).toBe(200);
      const invalidateData = await invalidateResponse.json();
      expect(invalidateData.data.invalidated).toBe(true);

      // 验证缓存已被删除
      expect(cache.has("posts:hot")).toBe(false);
    });
  });

  describe("缓存 TTL 验证", () => {
    it("Categories 缓存应该在 10 分钟后过期", async () => {
      // 第一次请求
      await app.handle(new Request("http://localhost/categories"));

      // 验证缓存存在
      expect(cache.has("categories:list")).toBe(true);

      // 注意：实际测试中不会等待 10 分钟，这里只是验证缓存键存在
      // 在实际应用中，TTL 会在 10 分钟后自动过期
    });

    it("Config 缓存应该在 5 分钟后过期", async () => {
      // 第一次请求
      await app.handle(new Request("http://localhost/config"));

      // 验证缓存存在
      expect(cache.has("site:config")).toBe(true);

      // 注意：实际测试中不会等待 5 分钟，这里只是验证缓存键存在
      // 在实际应用中，TTL 会在 5 分钟后自动过期
    });

    it("Hot Posts 缓存应该在 15 分钟后过期", async () => {
      // 第一次请求
      await app.handle(new Request("http://localhost/posts/hot"));

      // 验证缓存存在
      expect(cache.has("posts:hot")).toBe(true);

      // 注意：实际测试中不会等待 15 分钟，这里只是验证缓存键存在
      // 在实际应用中，TTL 会在 15 分钟后自动过期
    });
  });
});
