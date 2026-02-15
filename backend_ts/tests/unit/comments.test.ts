import type { Comment, JWTPayload } from "@/types/models";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_delete, db_insert } from "@/lib/db";
import { generateToken, jwtPlugin } from "@/middleware/auth";

// 导入 app 用于测试
import { commentsRoutes } from "@/routes/comments/index";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "comments";

const testApp = new Elysia().use(commentsRoutes);

// 测试数据
const testComment: Partial<Comment> = {
  author: "Test User",
  mail: "test@example.com",
  avatar: "https://example.com/avatar.jpg",
  text: "This is a test comment",
  refId: new ObjectId().toString(),
  refType: "post",
  created: new Date(),
  status: "approved",
};

const testUser: JWTPayload = {
  userId: new ObjectId().toString(),
  email: "test@example.com",
  role: "user",
};

const testAdmin: JWTPayload = {
  userId: new ObjectId().toString(),
  email: "admin@example.com",
  role: "admin",
};

let insertedCommentId: string;
let userToken: string;
let adminToken: string;

describe("Comments API", () => {
  beforeAll(async () => {
    // 清理测试数据
    await db_delete(DB_NAME, COLLECTION, { mail: "test@example.com" });

    // 插入测试评论
    const commentWithId = { ...testComment, _id: new ObjectId() };
    await db_insert(DB_NAME, COLLECTION, commentWithId);
    insertedCommentId = commentWithId._id.toString();

    // 生成测试 token
    const jwtApp = new Elysia().use(jwtPlugin());
    const jwtInstance = (jwtApp as any).decorator.jwt;
    userToken = await generateToken(jwtInstance, testUser);
    adminToken = await generateToken(jwtInstance, testAdmin);
  });

  afterAll(async () => {
    // 清理测试数据
    await db_delete(DB_NAME, COLLECTION, { mail: "test@example.com" });
    if (insertedCommentId) {
      await db_delete(DB_NAME, COLLECTION, { _id: new ObjectId(insertedCommentId) });
    }
  });

  describe("GET /comments", () => {
    it("should return paginated comments list", async () => {
      const response = await testApp.handle(
        new Request("http://localhost/comments?page=1&size=10"),
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

    it("should filter comments by refId", async () => {
      const response = await testApp.handle(
        new Request(`http://localhost/comments?refId=${testComment.refId}`),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.data.items).toBeInstanceOf(Array);

      // 所有返回的评论应该有相同的 refId
      for (const comment of data.data.items) {
        expect(comment.refId).toBe(testComment.refId);
      }
    });

    it("should filter comments by author", async () => {
      const response = await testApp.handle(
        new Request(`http://localhost/comments?author=${encodeURIComponent(testComment.author!)}`),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.data.items).toBeInstanceOf(Array);

      // 所有返回的评论应该有相同的作者
      for (const comment of data.data.items) {
        expect(comment.author).toBe(testComment.author);
      }
    });

    it("should filter comments by status", async () => {
      const response = await testApp.handle(
        new Request("http://localhost/comments?status=approved"),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.data.items).toBeInstanceOf(Array);

      // 所有返回的评论应该是已批准状态
      for (const comment of data.data.items) {
        expect(comment.status).toBe("approved");
      }
    });

    it("should return 400 for invalid refId format", async () => {
      const response = await testApp.handle(
        new Request("http://localhost/comments?refId=invalid-id"),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid refId format");
    });
  });

  describe("POST /comments", () => {
    it("should create a new comment", async () => {
      const newComment = {
        author: "New User",
        email: "newuser@example.com",
        text: "This is a new comment",
        refId: new ObjectId().toString(),
        refType: "post",
      };

      const response = await testApp.handle(
        new Request("http://localhost/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newComment),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.code).toBe(201);
      expect(data.status).toBe("success");
      expect(data.data.author).toBe(newComment.author);
      expect(data.data.mail).toBe(newComment.email);
      expect(data.data.text).toBe(newComment.text);
      expect(data.data.status).toBe("pending"); // 默认状态

      // 清理
      await db_delete(DB_NAME, COLLECTION, { mail: newComment.email });
    });

    it("should create a nested comment with parentId", async () => {
      const nestedComment = {
        author: "Nested User",
        email: "nested@example.com",
        text: "This is a nested comment",
        refId: testComment.refId!,
        refType: "post" as const,
        parentId: insertedCommentId,
      };

      const response = await testApp.handle(
        new Request("http://localhost/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nestedComment),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.code).toBe(201);
      expect(data.data.parentId).toBe(insertedCommentId);

      // 清理
      await db_delete(DB_NAME, COLLECTION, { mail: nestedComment.email });
    });

    it("should return 422 for missing required fields", async () => {
      const invalidComment = {
        author: "Test User",
        // 缺少 email, text, refId, refType
      };

      const response = await testApp.handle(
        new Request("http://localhost/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidComment),
        }),
      );

      // Elysia 返回 422 表示验证失败
      expect(response.status).toBe(422);
    });

    it("should return 404 for non-existent parent comment", async () => {
      const commentWithInvalidParent = {
        author: "Test User",
        email: "test@example.com",
        text: "Test comment",
        refId: new ObjectId().toString(),
        refType: "post",
        parentId: new ObjectId().toString(), // 不存在的父评论
      };

      const response = await testApp.handle(
        new Request("http://localhost/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commentWithInvalidParent),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.message).toContain("Parent comment not found");
    });

    it("should return 400 for invalid refId format", async () => {
      const invalidComment = {
        author: "Test User",
        email: "test@example.com",
        text: "Test comment",
        refId: "invalid-id",
        refType: "post",
      };

      const response = await testApp.handle(
        new Request("http://localhost/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidComment),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.message).toContain("Invalid refId format");
    });
  });

  describe("PUT /comments/:id", () => {
    it("should allow author to update their own comment", async () => {
      const updateData = {
        text: "Updated comment text",
      };

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${insertedCommentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`,
          },
          body: JSON.stringify(updateData),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.data.text).toBe(updateData.text);
    });

    it("should allow admin to update any comment", async () => {
      const updateData = {
        status: "spam" as const,
      };

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${insertedCommentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken}`,
          },
          body: JSON.stringify(updateData),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe(200);
      expect(data.data.status).toBe(updateData.status);

      // 恢复状态
      await db_delete(DB_NAME, COLLECTION, { _id: new ObjectId(insertedCommentId) });
      await db_insert(DB_NAME, COLLECTION, { ...testComment, _id: new ObjectId(insertedCommentId) });
    });

    it("should return 401 for unauthenticated update", async () => {
      const updateData = {
        text: "Updated text",
      };

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${insertedCommentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe(401);
      expect(data.message).toContain("Authentication required");
    });

    it("should return 403 for non-author/non-admin update", async () => {
      // 创建另一个用户的 token
      const otherUser: JWTPayload = {
        userId: new ObjectId().toString(),
        email: "other@example.com",
        role: "user",
      };
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;
      const otherToken = await generateToken(jwtInstance, otherUser);

      const updateData = {
        text: "Trying to update someone else's comment",
      };

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${insertedCommentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${otherToken}`,
          },
          body: JSON.stringify(updateData),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe(403);
      expect(data.message).toContain("Permission denied");
    });

    it("should return 404 for non-existent comment", async () => {
      const nonExistentId = new ObjectId().toString();
      const updateData = {
        text: "Updated text",
      };

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${nonExistentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`,
          },
          body: JSON.stringify(updateData),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.message).toContain("Comment not found");
    });

    it("should return 400 for invalid comment ID format", async () => {
      const updateData = {
        text: "Updated text",
      };

      const response = await testApp.handle(
        new Request("http://localhost/comments/invalid-id", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`,
          },
          body: JSON.stringify(updateData),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.message).toContain("Invalid comment ID format");
    });
  });

  describe("DELETE /comments/:id", () => {
    it("should allow author to delete their own comment", async () => {
      // 创建一个临时评论用于删除测试
      const tempComment = {
        ...testComment,
        _id: new ObjectId(),
        mail: "test@example.com",
      };
      await db_insert(DB_NAME, COLLECTION, tempComment);

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${tempComment._id.toString()}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }),
      );

      expect(response.status).toBe(204);
    });

    it("should allow admin to delete any comment", async () => {
      // 创建一个临时评论用于删除测试
      const tempComment = {
        ...testComment,
        _id: new ObjectId(),
        mail: "other@example.com",
      };
      await db_insert(DB_NAME, COLLECTION, tempComment);

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${tempComment._id.toString()}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }),
      );

      expect(response.status).toBe(204);
    });

    it("should return 401 for unauthenticated delete", async () => {
      const response = await testApp.handle(
        new Request(`http://localhost/comments/${insertedCommentId}`, {
          method: "DELETE",
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe(401);
      expect(data.message).toContain("Authentication required");
    });

    it("should return 403 for non-author/non-admin delete", async () => {
      // 创建另一个用户的 token
      const otherUser: JWTPayload = {
        userId: new ObjectId().toString(),
        email: "other@example.com",
        role: "user",
      };
      const jwtApp = new Elysia().use(jwtPlugin());
      const jwtInstance = (jwtApp as any).decorator.jwt;
      const otherToken = await generateToken(jwtInstance, otherUser);

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${insertedCommentId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${otherToken}`,
          },
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe(403);
      expect(data.message).toContain("Permission denied");
    });

    it("should return 404 for non-existent comment", async () => {
      const nonExistentId = new ObjectId().toString();

      const response = await testApp.handle(
        new Request(`http://localhost/comments/${nonExistentId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.message).toContain("Comment not found");
    });

    it("should return 400 for invalid comment ID format", async () => {
      const response = await testApp.handle(
        new Request("http://localhost/comments/invalid-id", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(400);
      expect(data.message).toContain("Invalid comment ID format");
    });
  });

  describe("Nested Comments", () => {
    it("should support parent-child comment relationships", async () => {
      // 创建父评论
      const parentComment = {
        author: "Parent User",
        email: "parent@example.com",
        text: "Parent comment",
        refId: new ObjectId().toString(),
        refType: "post" as const,
      };

      const parentResponse = await testApp.handle(
        new Request("http://localhost/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parentComment),
        }),
      );
      const parentData = await parentResponse.json();
      const parentId = parentData.data._id;

      // 创建子评论
      const childComment = {
        author: "Child User",
        email: "child@example.com",
        text: "Child comment",
        refId: parentComment.refId,
        refType: "post" as const,
        parentId,
      };

      const childResponse = await testApp.handle(
        new Request("http://localhost/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(childComment),
        }),
      );
      const childData = await childResponse.json();

      expect(childResponse.status).toBe(201);
      expect(childData.data.parentId).toBe(parentId);

      // 查询所有评论，验证父子关系
      const listResponse = await testApp.handle(
        new Request(`http://localhost/comments?refId=${parentComment.refId}`),
      );
      const listData = await listResponse.json();

      const comments = listData.data.items;
      const parent = comments.find((c: any) => c._id === parentId);
      const child = comments.find((c: any) => c.parentId === parentId);

      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      expect(child.parentId).toBe(parent._id);

      // 清理
      await db_delete(DB_NAME, COLLECTION, { mail: "parent@example.com" });
      await db_delete(DB_NAME, COLLECTION, { mail: "child@example.com" });
    });
  });
});
