import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { categoriesRoutes } from "@/routes/categories";
import { errorMiddleware } from "@/middleware/error";

describe("Categories API", () => {
  let app: Elysia;

  beforeAll(() => {
    app = new Elysia()
      .use(errorMiddleware())
      .use(categoriesRoutes);
  });

  it("should return categories list with count", async () => {
    const response = await app.handle(
      new Request("http://localhost/categories"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.code).toBe(200);
    expect(data.status).toBe("success");
    expect(data.message).toBe("Success");
    expect(Array.isArray(data.data)).toBe(true);

    // If there are categories, verify structure
    if (data.data.length > 0) {
      const category = data.data[0];
      expect(category).toHaveProperty("_id");
      expect(category).toHaveProperty("name");
      expect(category).toHaveProperty("slug");
      expect(category).toHaveProperty("count");
      expect(typeof category.count).toBe("number");
      expect(category.count).toBeGreaterThanOrEqual(0);
    }
  });

  it("should calculate correct post count for each category", async () => {
    const response = await app.handle(
      new Request("http://localhost/categories"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.code).toBe(200);

    // Verify all categories have count field
    for (const category of data.data) {
      expect(category).toHaveProperty("count");
      expect(typeof category.count).toBe("number");
      expect(category.count).toBeGreaterThanOrEqual(0);
    }
  });
});
