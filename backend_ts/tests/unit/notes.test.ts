import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { notesRoutes } from "../../src/routes/notes";

describe("Notes API", () => {
  let app: any;

  beforeAll(() => {
    app = new Elysia().use(notesRoutes);
  });

  afterAll(() => {
    app.stop();
  });

  describe("GET /notes", () => {
    it("should return paginated notes list", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes?page=1&size=10"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data).toHaveProperty("items");
      expect(data.data).toHaveProperty("pagination");
      expect(Array.isArray(data.data.items)).toBe(true);
    });

    it("should filter notes by mood", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes?mood=happy"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(Array.isArray(data.data.items)).toBe(true);
    });

    it("should filter notes by weather", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes?weather=sunny"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(Array.isArray(data.data.items)).toBe(true);
    });

    it("should sort notes by created time", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes?sortBy=created&order=asc"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
    });

    it("should sort notes by nid", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes?sortBy=nid&order=desc"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
    });

    it("should enforce maximum size limit of 100", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes?size=200"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.size).toBe(100);
      expect(data.data.items.length).toBeLessThanOrEqual(100);
    });

    it("should cap size at 100 even with very large values", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes?size=999999"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.size).toBe(100);
      expect(data.data.items.length).toBeLessThanOrEqual(100);
    });
  });

  describe("GET /notes/:id", () => {
    it("should return 400 for invalid note ID format", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes/invalid-id"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid");
    });

    it("should return 404 for non-existent note", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes/000000000000000000000000"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });
  });

  describe("GET /notes/nid/:nid", () => {
    it("should return 400 for invalid nid format", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes/nid/invalid"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid nid format");
    });

    it("should return 404 for non-existent nid", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes/nid/999999"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });
  });

  describe("GET /notes/nid/:nid/adjacent", () => {
    it("should return 400 for invalid nid format", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes/nid/invalid/adjacent"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid nid format");
    });

    it("should return 404 for non-existent note", async () => {
      const response = await app.handle(
        new Request("http://localhost/notes/nid/999999/adjacent"),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });
  });
});
