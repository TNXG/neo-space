import { describe, expect, it } from "bun:test";
import { Elysia, t } from "elysia";
import {
  BadRequestError,
  errorMiddleware,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../../src/middleware/error";

describe("Error Middleware", () => {
  it("should handle VALIDATION error with 400 status", async () => {
    const app = new Elysia()
      .use(errorMiddleware())
      .post(
        "/test",
        () => {
          return { success: true };
        },
        {
          body: t.Object({
            name: t.String(),
          }),
        },
      );

    const response = await app.handle(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "data" }),
      }),
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe(400);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Validation failed");
    expect(data.data).toBeNull();
  });

  it("should handle NOT_FOUND error with 404 status", async () => {
    const app = new Elysia().use(errorMiddleware());

    const response = await app.handle(
      new Request("http://localhost/nonexistent"),
    );

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe(404);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Resource not found");
    expect(data.data).toBeNull();
  });

  it("should handle PARSE error with 400 status", async () => {
    const app = new Elysia()
      .use(errorMiddleware())
      .post(
        "/test",
        ({ body }) => {
          return { success: true, body };
        },
        {
          body: t.Object({
            name: t.String(),
          }),
        },
      );

    const response = await app.handle(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json{",
      }),
    );

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe(400);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Failed to parse request");
    expect(data.data).toBeNull();
  });

  it("should handle custom HttpError with custom status code", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new HttpError(418, "I'm a teapot");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(418);
    expect(data.code).toBe(418);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("I'm a teapot");
    expect(data.data).toBeNull();
  });

  it("should handle BadRequestError with 400 status", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new BadRequestError("Invalid input");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe(400);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Invalid input");
    expect(data.data).toBeNull();
  });

  it("should handle UnauthorizedError with 401 status", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new UnauthorizedError("Authentication required");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe(401);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Authentication required");
    expect(data.data).toBeNull();
  });

  it("should handle ForbiddenError with 403 status", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new ForbiddenError("Access denied");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe(403);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Access denied");
    expect(data.data).toBeNull();
  });

  it("should handle NotFoundError with 404 status", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new NotFoundError("Resource not found");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe(404);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Resource not found");
    expect(data.data).toBeNull();
  });

  it("should handle InternalServerError with 500 status", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new InternalServerError("Something went wrong");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe(500);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Something went wrong");
    expect(data.data).toBeNull();
  });

  it("should handle generic Error with 500 status", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new Error("Unexpected error");
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe(500);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Unexpected error");
    expect(data.data).toBeNull();
  });

  it("should handle unknown error type with 500 status", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw "String error";
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe(500);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Internal server error");
    expect(data.data).toBeNull();
  });

  it("should use default message for custom error classes without message", async () => {
    const app = new Elysia().use(errorMiddleware()).get("/test", () => {
      throw new BadRequestError();
    });

    const response = await app.handle(new Request("http://localhost/test"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe(400);
    expect(data.status).toBe("failed");
    expect(data.message).toBe("Bad request");
    expect(data.data).toBeNull();
  });
});
