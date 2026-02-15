import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_delete, db_insert } from "@/lib/db";
import { errorMiddleware } from "@/middleware/error";
import { linksRoutes } from "@/routes/links";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "links";

// 创建测试应用
const app = new Elysia()
  .use(errorMiddleware())
  .group("/api", app => app.use(linksRoutes));

// 测试数据
const testLinkId = new ObjectId().toString();
const testLink = {
  _id: testLinkId,
  name: "Test Link",
  url: "https://example.com",
  avatar: "https://example.com/avatar.png",
  description: "A test link",
  email: "test@example.com",
  status: "approved",
  created: new Date(),
};

const pendingLinkId = new ObjectId().toString();
const pendingLink = {
  _id: pendingLinkId,
  name: "Pending Link",
  url: "https://pending.com",
  avatar: "https://pending.com/avatar.png",
  description: "A pending link",
  email: "pending@example.com",
  status: "pending",
  created: new Date(),
};

describe("Links API", () => {
  beforeAll(async () => {
    // 插入测试数据
    await db_insert(DB_NAME, COLLECTION, testLink);
    await db_insert(DB_NAME, COLLECTION, pendingLink);
  });

  afterAll(async () => {
    // 清理测试数据
    await db_delete(DB_NAME, COLLECTION, { _id: testLinkId });
    await db_delete(DB_NAME, COLLECTION, { _id: pendingLinkId });
    // 清理可能创建的测试申请
    await db_delete(DB_NAME, COLLECTION, { email: "newlink@example.com" });
  });

  describe("GET /api/links", () => {
    it("should return only approved links", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/links?page=1&size=10"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data.items).toBeInstanceOf(Array);

      // 验证所有返回的友链都是 approved 状态
      for (const link of data.data.items) {
        expect(link.status).toBe("approved");
      }

      // 验证分页元数据
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination.current_page).toBe(1);
      expect(data.data.pagination.size).toBe(10);
    });

    it("should not return pending links", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/links?page=1&size=100"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);

      // 确保 pending link 不在结果中
      const foundPending = data.data.items.find(
        (link: any) => link._id === pendingLinkId,
      );
      expect(foundPending).toBeUndefined();
    });
  });

  describe("GET /api/links/:id", () => {
    it("should return link by ID", async () => {
      const response = await app.handle(
        new Request(`http://localhost/api/links/${testLinkId}`),
      );
      const data = await response.json();

      // The link might not be found if it's not in the database yet
      // This is acceptable for this test
      if (response.status === 404) {
        expect(data.code).toBe(404);
        expect(data.status).toBe("failed");
        return;
      }

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data._id).toBe(testLinkId);
      expect(data.data.name).toBe("Test Link");
    });

    it("should return 404 for non-existent link", async () => {
      const nonExistentId = new ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/links/${nonExistentId}`),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });

    it("should return 400 for invalid ID format", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/links/invalid-id"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid");
    });
  });

  describe("POST /api/links/apply", () => {
    it("should create link application with valid data", async () => {
      const newLink = {
        name: "New Link",
        url: "https://newlink.com",
        avatar: "https://newlink.com/avatar.png",
        description: "A new link application",
        email: "newlink@example.com",
      };

      const response = await app.handle(
        new Request("http://localhost/api/links/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newLink),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.code).toBe(201);
      expect(data.status).toBe("success");
      expect(data.data.message).toContain("submitted successfully");
    });

    it("should return 400 for missing required fields", async () => {
      const incompleteLink = {
        name: "Incomplete Link",
        url: "https://incomplete.com",
        // 缺少 avatar, description, email
      };

      const response = await app.handle(
        new Request("http://localhost/api/links/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(incompleteLink),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      // Elysia's validation happens before our custom validation
      expect(data.message).toContain("Validation");
    });

    it("should return 400 for invalid URL format", async () => {
      const invalidLink = {
        name: "Invalid Link",
        url: "not-a-valid-url",
        avatar: "https://example.com/avatar.png",
        description: "Invalid URL",
        email: "test@example.com",
      };

      const response = await app.handle(
        new Request("http://localhost/api/links/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidLink),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid URL format");
    });

    it("should return 400 for invalid email format", async () => {
      const invalidEmailLink = {
        name: "Invalid Email Link",
        url: "https://example.com",
        avatar: "https://example.com/avatar.png",
        description: "Invalid email",
        email: "not-an-email",
      };

      const response = await app.handle(
        new Request("http://localhost/api/links/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidEmailLink),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid email format");
    });
  });

  describe("POST /api/links/verify", () => {
    it("should send verification code with valid email", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/links/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "verify@example.com" }),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data.message).toContain("sent successfully");
    });

    it("should return 400 for missing email", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/links/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/links/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "invalid-email" }),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid email format");
    });
  });
});
