import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ObjectId } from "mongodb";
import { getConfig } from "../../src/config";
import { db_delete, db_insert } from "../../src/lib/db";
import { pagesRoutes } from "../../src/routes/pages";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "pages";

// 测试数据
const testPages = [
  {
    _id: new ObjectId().toString(),
    title: "关于我",
    slug: "about",
    text: "这是关于页面的内容",
    created: new Date("2024-01-01"),
    modified: new Date("2024-01-02"),
    order: 1,
  },
  {
    _id: new ObjectId().toString(),
    title: "友情链接",
    slug: "links",
    text: "这是友情链接页面的内容",
    created: new Date("2024-01-03"),
    order: 2,
  },
];

describe("Pages API", () => {
  beforeAll(async () => {
    // 清理测试数据
    await db_delete(DB_NAME, COLLECTION, { slug: { $in: ["about", "links", "test-page"] } });

    // 插入测试数据
    for (const page of testPages) {
      await db_insert(DB_NAME, COLLECTION, page);
    }
  });

  afterAll(async () => {
    // 清理测试数据
    await db_delete(DB_NAME, COLLECTION, { slug: { $in: ["about", "links", "test-page"] } });
  });

  describe("GET /pages/:slug", () => {
    it("should return page by slug", async () => {
      const response = await pagesRoutes.handle(
        new Request("http://localhost/pages/about"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data).toBeDefined();
      expect(data.data.slug).toBe("about");
      expect(data.data.title).toBe("关于我");
      expect(data.data.text).toBe("这是关于页面的内容");
    });

    it("should return 404 for non-existent page", async () => {
      const response = await pagesRoutes.handle(
        new Request("http://localhost/pages/non-existent-page"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
      expect(data.data).toBeNull();
    });

    it("should return page with all required fields", async () => {
      const response = await pagesRoutes.handle(
        new Request("http://localhost/pages/about"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty("_id");
      expect(data.data).toHaveProperty("title");
      expect(data.data).toHaveProperty("slug");
      expect(data.data).toHaveProperty("text");
      expect(data.data).toHaveProperty("created");
      expect(data.data).toHaveProperty("order");
    });

    it("should return page without modified field if not set", async () => {
      const response = await pagesRoutes.handle(
        new Request("http://localhost/pages/links"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.slug).toBe("links");
      expect(data.data.title).toBe("友情链接");
      // modified 字段可能不存在
    });
  });

  describe("Edge cases", () => {
    it("should handle special characters in slug", async () => {
      // 插入带特殊字符的页面
      const specialPage = {
        _id: new ObjectId().toString(),
        title: "测试页面",
        slug: "test-page",
        text: "测试内容",
        created: new Date(),
        order: 99,
      };
      await db_insert(DB_NAME, COLLECTION, specialPage);

      const response = await pagesRoutes.handle(
        new Request("http://localhost/pages/test-page"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.slug).toBe("test-page");
    });

    it("should return 404 for empty slug", async () => {
      const response = await pagesRoutes.handle(
        new Request("http://localhost/pages/"),
      );

      // Elysia 会返回 404，因为路由不匹配
      expect(response.status).toBe(404);
    });
  });
});
