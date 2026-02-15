import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "../../src/config";
import { db_delete, db_insert } from "../../src/lib/db";
import { errorMiddleware } from "../../src/middleware/error";
import { paginationPlugin } from "../../src/plugins/pagination";
import { responsePlugin } from "../../src/plugins/response";
import { recentliesRoutes } from "../../src/routes/recentlies";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "recentlies";

// 创建测试应用
const app = new Elysia()
  .use(errorMiddleware())
  .use(paginationPlugin())
  .use(responsePlugin())
  .group("/api", app => app.use(recentliesRoutes));

// 测试数据
const testRecentlies = [
  {
    _id: new ObjectId().toString(),
    content: "Test recently 1",
    up: 0,
    down: 0,
    created: new Date("2024-01-01"),
    refType: "status",
  },
  {
    _id: new ObjectId().toString(),
    content: "Test recently 2",
    up: 5,
    down: 1,
    created: new Date("2024-01-15"),
    refType: "link",
  },
  {
    _id: new ObjectId().toString(),
    content: "Test recently 3",
    up: 10,
    down: 0,
    created: new Date("2024-02-01"),
    refType: "image",
  },
];

describe("Recentlies API", () => {
  beforeAll(async () => {
    // 清理测试数据
    await db_delete(DB_NAME, COLLECTION, {
      _id: { $in: testRecentlies.map(r => r._id) },
    });

    // 插入测试数据
    for (const recently of testRecentlies) {
      await db_insert(DB_NAME, COLLECTION, recently);
    }
  });

  afterAll(async () => {
    // 清理测试数据
    await db_delete(DB_NAME, COLLECTION, {
      _id: { $in: testRecentlies.map(r => r._id) },
    });
  });

  describe("GET /api/recentlies", () => {
    it("should return paginated recentlies list", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/recentlies?page=1&size=10"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination.current_page).toBe(1);
      expect(data.data.pagination.size).toBe(10);
    });

    it("should filter recentlies by type", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/recentlies?type=link"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");

      // 验证所有返回的动态都是 link 类型
      const items = data.data.items;
      for (const item of items) {
        if (testRecentlies.find(r => r._id === item._id)) {
          expect(item.refType).toBe("link");
        }
      }
    });

    it("should filter recentlies by date range", async () => {
      const startDate = "2024-01-10";
      const endDate = "2024-01-20";

      const response = await app.handle(
        new Request(
          `http://localhost/api/recentlies?startDate=${startDate}&endDate=${endDate}`,
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");

      // 验证所有返回的动态都在日期范围内
      const items = data.data.items;
      for (const item of items) {
        if (testRecentlies.find(r => r._id === item._id)) {
          const created = new Date(item.created);
          expect(created >= new Date(startDate)).toBe(true);
          expect(created <= new Date(endDate)).toBe(true);
        }
      }
    });

    it("should return empty list when no recentlies match filter", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/recentlies?type=nonexistent"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.pagination.total).toBe(0);
    });

    it("should return recentlies sorted by created date descending", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/recentlies?page=1&size=100"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      const items = data.data.items;

      // 过滤出我们的测试数据
      const testItems = items.filter((item: any) =>
        testRecentlies.find(r => r._id === item._id),
      );

      // 验证排序（按创建时间倒序）
      for (let i = 0; i < testItems.length - 1; i++) {
        const current = new Date(testItems[i].created);
        const next = new Date(testItems[i + 1].created);
        expect(current >= next).toBe(true);
      }
    });

    it("should respect pagination parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/recentlies?page=1&size=2"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.items.length).toBeLessThanOrEqual(2);
      expect(data.data.pagination.size).toBe(2);
    });

    it("should handle combined filters (type and date range)", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/recentlies?type=link&startDate=2024-01-01&endDate=2024-12-31",
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");

      // 验证返回的数据同时满足类型和日期范围过滤
      const items = data.data.items;
      for (const item of items) {
        if (testRecentlies.find(r => r._id === item._id)) {
          expect(item.refType).toBe("link");
          const created = new Date(item.created);
          expect(created >= new Date("2024-01-01")).toBe(true);
          expect(created <= new Date("2024-12-31")).toBe(true);
        }
      }
    });
  });
});
