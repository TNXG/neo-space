import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { paginationPlugin } from "../../src/plugins/pagination";

describe("Pagination Plugin", () => {
  it("should use default values when no parameters provided", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination, createPaginationMeta }) => {
        return {
          pagination,
          meta: createPaginationMeta(100),
        };
      });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(data.pagination.page).toBe(1);
    expect(data.pagination.size).toBe(10);
    expect(data.pagination.skip).toBe(0);
    expect(data.meta.current_page).toBe(1);
    expect(data.meta.size).toBe(10);
    expect(data.meta.total).toBe(100);
    expect(data.meta.total_page).toBe(10);
    expect(data.meta.has_next_page).toBe(true);
    expect(data.meta.has_prev_page).toBe(false);
  });

  it("should parse page and size parameters correctly", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination, createPaginationMeta }) => {
        return {
          pagination,
          meta: createPaginationMeta(100),
        };
      });

    const response = await app.handle(
      new Request("http://localhost/test?page=3&size=20"),
    );
    const data = await response.json();

    expect(data.pagination.page).toBe(3);
    expect(data.pagination.size).toBe(20);
    expect(data.pagination.skip).toBe(40); // (3-1) * 20
    expect(data.meta.current_page).toBe(3);
    expect(data.meta.size).toBe(20);
    expect(data.meta.total_page).toBe(5); // ceil(100/20)
    expect(data.meta.has_next_page).toBe(true);
    expect(data.meta.has_prev_page).toBe(true);
  });

  it("should enforce minimum page value of 1", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination }) => ({ pagination }));

    const response = await app.handle(
      new Request("http://localhost/test?page=0"),
    );
    const data = await response.json();

    expect(data.pagination.page).toBe(1);
    expect(data.pagination.skip).toBe(0);
  });

  it("should enforce minimum size value of 1", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination }) => ({ pagination }));

    const response = await app.handle(
      new Request("http://localhost/test?size=0"),
    );
    const data = await response.json();

    expect(data.pagination.size).toBe(1);
  });

  it("should enforce maximum size value of 100", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination }) => ({ pagination }));

    const response = await app.handle(
      new Request("http://localhost/test?size=200"),
    );
    const data = await response.json();

    expect(data.pagination.size).toBe(100);
  });

  it("should handle invalid page parameter gracefully", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination }) => ({ pagination }));

    const response = await app.handle(
      new Request("http://localhost/test?page=invalid"),
    );
    const data = await response.json();

    expect(data.pagination.page).toBe(1);
  });

  it("should handle invalid size parameter gracefully", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination }) => ({ pagination }));

    const response = await app.handle(
      new Request("http://localhost/test?size=invalid"),
    );
    const data = await response.json();

    expect(data.pagination.size).toBe(10);
  });

  it("should calculate skip correctly for various pages", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination }) => ({ pagination }));

    // Page 1, size 10: skip = 0
    let response = await app.handle(
      new Request("http://localhost/test?page=1&size=10"),
    );
    let data = await response.json();
    expect(data.pagination.skip).toBe(0);

    // Page 2, size 10: skip = 10
    response = await app.handle(
      new Request("http://localhost/test?page=2&size=10"),
    );
    data = await response.json();
    expect(data.pagination.skip).toBe(10);

    // Page 5, size 25: skip = 100
    response = await app.handle(
      new Request("http://localhost/test?page=5&size=25"),
    );
    data = await response.json();
    expect(data.pagination.skip).toBe(100);
  });

  it("should calculate pagination metadata correctly for last page", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ pagination, createPaginationMeta }) => {
        return {
          pagination,
          meta: createPaginationMeta(95), // 95 items with size 10 = 10 pages
        };
      });

    const response = await app.handle(
      new Request("http://localhost/test?page=10&size=10"),
    );
    const data = await response.json();

    expect(data.meta.current_page).toBe(10);
    expect(data.meta.total_page).toBe(10);
    expect(data.meta.has_next_page).toBe(false);
    expect(data.meta.has_prev_page).toBe(true);
  });

  it("should handle empty result set", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ createPaginationMeta }) => {
        return {
          meta: createPaginationMeta(0),
        };
      });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(data.meta.total).toBe(0);
    expect(data.meta.total_page).toBe(0);
    expect(data.meta.has_next_page).toBe(false);
    expect(data.meta.has_prev_page).toBe(false);
  });

  it("should handle single page result", async () => {
    const app = new Elysia()
      .use(paginationPlugin())
      .get("/test", ({ createPaginationMeta }) => {
        return {
          meta: createPaginationMeta(5), // 5 items with default size 10 = 1 page
        };
      });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(data.meta.total).toBe(5);
    expect(data.meta.total_page).toBe(1);
    expect(data.meta.has_next_page).toBe(false);
    expect(data.meta.has_prev_page).toBe(false);
  });
});
