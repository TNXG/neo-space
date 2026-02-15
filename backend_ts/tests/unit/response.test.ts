import type { PaginationMeta } from "../../src/plugins/pagination";
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { responsePlugin, ResponseStatus } from "../../src/plugins/response";

describe("Response Plugin", () => {
  it("should format success response with default status code", () => {
    const app = new Elysia().use(responsePlugin()).get("/test", ({ success }) => {
      return success({ id: 1, name: "Test" });
    });

    const response = app.handle(new Request("http://localhost/test")).then(res => res.json());

    return response.then((data) => {
      expect(data.code).toBe(200);
      expect(data.status).toBe(ResponseStatus.Success);
      expect(data.message).toBe("Success");
      expect(data.data).toEqual({ id: 1, name: "Test" });
    });
  });

  it("should format success response with custom status code", () => {
    const app = new Elysia().use(responsePlugin()).post("/test", ({ success }) => {
      return success({ id: 1 }, 201);
    });

    const response = app.handle(new Request("http://localhost/test", { method: "POST" })).then(res => res.json());

    return response.then((data) => {
      expect(data.code).toBe(201);
      expect(data.status).toBe(ResponseStatus.Success);
      expect(data.message).toBe("Success");
      expect(data.data).toEqual({ id: 1 });
    });
  });

  it("should format success response with custom message", () => {
    const app = new Elysia().use(responsePlugin()).get("/test", ({ successWithMessage }) => {
      return successWithMessage({ id: 1 }, "Created successfully");
    });

    const response = app.handle(new Request("http://localhost/test")).then(res => res.json());

    return response.then((data) => {
      expect(data.code).toBe(200);
      expect(data.status).toBe(ResponseStatus.Success);
      expect(data.message).toBe("Created successfully");
      expect(data.data).toEqual({ id: 1 });
    });
  });

  it("should format paginated response", () => {
    const app = new Elysia().use(responsePlugin()).get("/test", ({ paginated }) => {
      const items = [{ id: 1 }, { id: 2 }];
      const pagination: PaginationMeta = {
        total: 10,
        current_page: 1,
        total_page: 5,
        size: 2,
        has_next_page: true,
        has_prev_page: false,
      };
      return paginated(items, pagination);
    });

    const response = app.handle(new Request("http://localhost/test")).then(res => res.json());

    return response.then((data) => {
      expect(data.code).toBe(200);
      expect(data.status).toBe(ResponseStatus.Success);
      expect(data.message).toBe("Success");
      expect(data.data.items).toEqual([{ id: 1 }, { id: 2 }]);
      expect(data.data.pagination).toEqual({
        total: 10,
        current_page: 1,
        total_page: 5,
        size: 2,
        has_next_page: true,
        has_prev_page: false,
      });
    });
  });

  it("should format error response with status failed and data null", () => {
    const app = new Elysia().use(responsePlugin()).get("/test", ({ error, set }) => {
      set.status = 404;
      return error(404, "Resource not found");
    });

    const response = app.handle(new Request("http://localhost/test")).then(res => res.json());

    return response.then((data) => {
      expect(data.code).toBe(404);
      expect(data.status).toBe(ResponseStatus.Failed);
      expect(data.message).toBe("Resource not found");
      expect(data.data).toBeNull();
    });
  });

  it("should format error response for different status codes", () => {
    const app = new Elysia().use(responsePlugin()).get("/test", ({ error, set }) => {
      set.status = 500;
      return error(500, "Internal server error");
    });

    const response = app.handle(new Request("http://localhost/test")).then(res => res.json());

    return response.then((data) => {
      expect(data.code).toBe(500);
      expect(data.status).toBe(ResponseStatus.Failed);
      expect(data.message).toBe("Internal server error");
      expect(data.data).toBeNull();
    });
  });
});
