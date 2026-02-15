import { beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { postsRoutes } from "../../src/routes/posts";

describe("Posts API", () => {
  let app: any;

  beforeAll(() => {
    app = new Elysia().use(postsRoutes);
  });

  describe("GET /posts/:id", () => {
    it("should return 400 for invalid post ID format", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts/invalid-id"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid");
    });

    it("should return 404 for non-existent post", async () => {
      // 使用有效的 ObjectId 格式但不存在的 ID
      const response = await app.handle(
        new Request("http://localhost/posts/000000000000000000000000"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });
  });

  describe("GET /posts/slug/:slug", () => {
    it("should return 404 for non-existent slug", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts/slug/non-existent-slug-12345"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });
  });

  describe("GET /posts/:id/adjacent", () => {
    it("should return 400 for invalid post ID format", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts/invalid-id/adjacent"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid");
    });

    it("should return 404 for non-existent post", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts/000000000000000000000000/adjacent"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });
  });

  describe("GET /posts", () => {
    it("should return paginated response with default parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data).toHaveProperty("items");
      expect(data.data).toHaveProperty("pagination");
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.pagination).toHaveProperty("total");
      expect(data.data.pagination).toHaveProperty("current_page");
      expect(data.data.pagination).toHaveProperty("total_page");
      expect(data.data.pagination).toHaveProperty("size");
      expect(data.data.pagination).toHaveProperty("has_next_page");
      expect(data.data.pagination).toHaveProperty("has_prev_page");
    });

    it("should accept pagination parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts?page=2&size=5"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.current_page).toBe(2);
      expect(data.data.pagination.size).toBe(5);
    });

    it("should return 400 for invalid category ID format", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts?category=invalid-id"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid category ID");
    });

    it("should accept valid category filter", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts?category=507f1f77bcf86cd799439011"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty("items");
    });

    it("should accept tag filter", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts?tag=javascript"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty("items");
    });

    it("should accept sort parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts?sortBy=created&order=asc"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty("items");
    });

    it("should enforce maximum size limit of 100", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts?size=200"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.size).toBe(100);
      expect(data.data.items.length).toBeLessThanOrEqual(100);
    });

    it("should cap size at 100 even with very large values", async () => {
      const response = await app.handle(
        new Request("http://localhost/posts?size=999999"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.size).toBe(100);
      expect(data.data.items.length).toBeLessThanOrEqual(100);
    });
  });
});
