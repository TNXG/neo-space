import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
  authMiddleware,
  generateToken,
  jwtPlugin,
  requireAdmin,
  requireAuth,
} from "../../src/middleware/auth";

describe("Authentication Middleware", () => {
  describe("authMiddleware", () => {
    it("should return null user when no Authorization header", async () => {
      const app = new Elysia().use(authMiddleware()).get("/test", ({ user }) => {
        return { user };
      });

      const response = await app.handle(new Request("http://localhost/test"));
      const data = await response.json();

      expect(data.user).toBeNull();
    });

    it("should return null user when Authorization header is empty", async () => {
      const app = new Elysia().use(authMiddleware()).get("/test", ({ user }) => {
        return { user };
      });

      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { Authorization: "" },
        }),
      );
      const data = await response.json();

      expect(data.user).toBeNull();
    });

    it("should return null user when token is invalid", async () => {
      const app = new Elysia().use(authMiddleware()).get("/test", ({ user }) => {
        return { user };
      });

      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { Authorization: "Bearer invalid-token" },
        }),
      );
      const data = await response.json();

      expect(data.user).toBeNull();
    });

    it("should parse valid JWT token and return user", async () => {
      const app = new Elysia()
        .use(jwtPlugin())
        .use(authMiddleware())
        .get("/test", ({ user }) => {
          return { user };
        });

      // Generate a valid token
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const token = await generateToken(jwtInstance, {
        userId: "123",
        email: "test@example.com",
        role: "user",
      });

      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const data = await response.json();

      expect(data.user).not.toBeNull();
      expect(data.user.userId).toBe("123");
      expect(data.user.email).toBe("test@example.com");
      expect(data.user.role).toBe("user");
    });

    it("should support Authorization header without Bearer prefix", async () => {
      const app = new Elysia()
        .use(jwtPlugin())
        .use(authMiddleware())
        .get("/test", ({ user }) => {
          return { user };
        });

      // Generate a valid token
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const token = await generateToken(jwtInstance, {
        userId: "456",
        email: "user@example.com",
        role: "admin",
      });

      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { Authorization: token },
        }),
      );
      const data = await response.json();

      expect(data.user).not.toBeNull();
      expect(data.user.userId).toBe("456");
      expect(data.user.email).toBe("user@example.com");
      expect(data.user.role).toBe("admin");
    });
  });

  describe("requireAuth", () => {
    it("should return 401 when user is not authenticated", async () => {
      const app = new Elysia()
        .use(requireAuth())
        .get("/protected", () => {
          return { message: "success" };
        });

      const response = await app.handle(
        new Request("http://localhost/protected"),
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe(401);
      expect(data.status).toBe("failed");
      expect(data.message).toBe("Authentication required");
      expect(data.data).toBeNull();
    });

    it("should allow access when user is authenticated", async () => {
      const app = new Elysia()
        .use(jwtPlugin())
        .use(requireAuth())
        .get("/protected", () => {
          return { message: "success" };
        });

      // Generate a valid token
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const token = await generateToken(jwtInstance, {
        userId: "789",
        email: "auth@example.com",
        role: "user",
      });

      const response = await app.handle(
        new Request("http://localhost/protected", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("success");
    });
  });

  describe("requireAdmin", () => {
    it("should return 401 when user is not authenticated", async () => {
      const app = new Elysia()
        .use(requireAdmin())
        .get("/admin", () => {
          return { message: "admin access" };
        });

      const response = await app.handle(new Request("http://localhost/admin"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe(401);
      expect(data.status).toBe("failed");
      expect(data.message).toBe("Authentication required");
    });

    it("should return 403 when user is not admin", async () => {
      const app = new Elysia()
        .use(jwtPlugin())
        .use(requireAdmin())
        .get("/admin", () => {
          return { message: "admin access" };
        });

      // Generate a token for regular user
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const token = await generateToken(jwtInstance, {
        userId: "999",
        email: "user@example.com",
        role: "user",
      });

      const response = await app.handle(
        new Request("http://localhost/admin", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe(403);
      expect(data.status).toBe("failed");
      expect(data.message).toBe("Admin access required");
    });

    it("should allow access when user is admin", async () => {
      const app = new Elysia()
        .use(jwtPlugin())
        .use(requireAdmin())
        .get("/admin", () => {
          return { message: "admin access" };
        });

      // Generate a token for admin user
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const token = await generateToken(jwtInstance, {
        userId: "1",
        email: "admin@example.com",
        role: "admin",
      });

      const response = await app.handle(
        new Request("http://localhost/admin", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("admin access");
    });
  });

  describe("generateToken", () => {
    it("should generate a valid JWT token", async () => {
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const token = await generateToken(jwtInstance, {
        userId: "test-123",
        email: "test@example.com",
        role: "user",
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);

      // Verify the token can be decoded
      const payload = await jwtInstance.verify(token);
      expect(payload).not.toBeNull();
      expect(payload.userId).toBe("test-123");
      expect(payload.email).toBe("test@example.com");
      expect(payload.role).toBe("user");
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    it("should include expiration time in token", async () => {
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const token = await generateToken(jwtInstance, {
        userId: "test-456",
        email: "test2@example.com",
        role: "admin",
      });

      const payload = await jwtInstance.verify(token);
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);

      // Default expiration is 7 days
      const expectedExpiration = payload.iat + 7 * 24 * 60 * 60;
      expect(payload.exp).toBe(expectedExpiration);
    });
  });

  describe("JWT round trip", () => {
    it("should maintain payload integrity through sign and verify", async () => {
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const originalPayload = {
        userId: "round-trip-test",
        email: "roundtrip@example.com",
        role: "user" as const,
      };

      // Generate token
      const token = await generateToken(jwtInstance, originalPayload);

      // Verify token
      const verifiedPayload = await jwtInstance.verify(token);

      // Check all fields match
      expect(verifiedPayload.userId).toBe(originalPayload.userId);
      expect(verifiedPayload.email).toBe(originalPayload.email);
      expect(verifiedPayload.role).toBe(originalPayload.role);
    });

    it("should handle admin role correctly", async () => {
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;

      const adminPayload = {
        userId: "admin-123",
        email: "admin@example.com",
        role: "admin" as const,
      };

      const token = await generateToken(jwtInstance, adminPayload);
      const verifiedPayload = await jwtInstance.verify(token);

      expect(verifiedPayload.role).toBe("admin");
    });
  });
});
