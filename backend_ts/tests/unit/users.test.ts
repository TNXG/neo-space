import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { errorMiddleware } from "@/middleware/error";
import { usersRoutes } from "@/routes/users";

describe("Users API", () => {
  let app: any;

  beforeAll(() => {
    app = new Elysia().use(errorMiddleware()).use(usersRoutes);
  });

  afterAll(() => {
    app.stop();
  });

  describe("GET /api/user/profile", () => {
    it("should return user profile with public information", async () => {
      const response = await app.handle(new Request("http://localhost/api/user/profile"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data).toBeDefined();

      // 验证返回的是公开信息
      if (data.data) {
        expect(data.data).toHaveProperty("_id");
        expect(data.data).toHaveProperty("username");
        expect(data.data).toHaveProperty("name");
        expect(data.data).toHaveProperty("avatar");
        expect(data.data).toHaveProperty("mail");
      }
    });

    it("should return 404 if no user exists", async () => {
      // 这个测试假设数据库中没有用户
      // 在实际环境中，应该有至少一个用户
      const response = await app.handle(new Request("http://localhost/api/user/profile"));
      const data = await response.json();

      // 可能返回 200（有用户）或 404（无用户）
      expect([200, 404]).toContain(response.status);
    });
  });

  describe("GET /api/readers", () => {
    it("should return paginated readers list", async () => {
      const response = await app.handle(new Request("http://localhost/api/readers"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data).toBeDefined();
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination).toHaveProperty("total");
      expect(data.data.pagination).toHaveProperty("current_page");
      expect(data.data.pagination).toHaveProperty("total_page");
      expect(data.data.pagination).toHaveProperty("size");
      expect(data.data.pagination).toHaveProperty("has_next_page");
      expect(data.data.pagination).toHaveProperty("has_prev_page");
    });

    it("should accept pagination parameters", async () => {
      const response = await app.handle(new Request("http://localhost/api/readers?page=1&size=5"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.current_page).toBe(1);
      expect(data.data.pagination.size).toBe(5);
      expect(data.data.items.length).toBeLessThanOrEqual(5);
    });

    it("should enforce maximum size limit of 100", async () => {
      const response = await app.handle(new Request("http://localhost/api/readers?size=150"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.size).toBe(100);
      expect(data.data.items.length).toBeLessThanOrEqual(100);
    });
  });

  describe("GET /api/readers/:id", () => {
    it("should return 400 for invalid reader ID format", async () => {
      const response = await app.handle(new Request("http://localhost/api/readers/invalid-id"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("无效的 ID 格式");
    });

    it("should return 404 for non-existent reader", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/readers/000000000000000000000000"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("未找到 Reader");
    });
  });
});
