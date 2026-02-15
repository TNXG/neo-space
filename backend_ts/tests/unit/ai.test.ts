import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_delete } from "@/lib/db";
import { aiRoutes } from "@/routes/ai";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const TIME_CAPSULES_COLLECTION = "time_capsules";

// 测试数据
const testRefId = new ObjectId().toString();
const testContent = "React 18 新特性介绍\n\n本文介绍 React 18 的新特性和 API 变化";

describe("AI API - Time Capsule", () => {
  let app: any;

  beforeAll(() => {
    app = new Elysia().use(aiRoutes);
  });

  // 清理测试数据
  afterAll(async () => {
    await db_delete(DB_NAME, TIME_CAPSULES_COLLECTION, { refId: testRefId });
  });

  describe("POST /ai/time-capsule/analyze", () => {
    it("should analyze time capsule and return result", async () => {
      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: testRefId,
            refType: "post",
            content: testContent,
          }),
        }),
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data).toBeDefined();
      expect(data.data.sensitivity).toMatch(/^(high|medium|low)$/);
      expect(data.data.reason).toBeDefined();
      expect(data.data.markers).toBeInstanceOf(Array);
      expect(data.data.isNew).toBe(true);
    });

    it("should return cached result for same content", async () => {
      // 第一次分析
      await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: testRefId,
            refType: "post",
            content: testContent,
          }),
        }),
      );

      // 第二次分析（应该返回缓存）
      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: testRefId,
            refType: "post",
            content: testContent,
          }),
        }),
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.data.isNew).toBe(false); // 应该是缓存结果
    });

    it("should return 400 for missing required fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: testRefId,
            // 缺少 refType 和 content
          }),
        }),
      );

      // Elysia returns 422 for validation errors
      expect(response.status).toBe(422);
    });

    it("should return 400 for invalid refType", async () => {
      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: testRefId,
            refType: "invalid",
            content: testContent,
          }),
        }),
      );

      // Elysia returns 422 for validation errors
      expect(response.status).toBe(422);
    });

    it("should return 400 for invalid refId format", async () => {
      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: "invalid-id",
            refType: "post",
            content: testContent,
          }),
        }),
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid refId");
    });

    it("should detect high sensitivity for technical content", async () => {
      const technicalContent
        = "React 18 API 配置\n\nNode.js 20 配置指南，包含 API endpoint 和配置方式";
      const techRefId = new ObjectId().toString();

      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: techRefId,
            refType: "post",
            content: technicalContent,
          }),
        }),
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.sensitivity).toBe("high");
      expect(data.data.markers.length).toBeGreaterThan(0);

      // 清理
      await db_delete(DB_NAME, TIME_CAPSULES_COLLECTION, { refId: techRefId });
    });

    it("should detect low sensitivity for conceptual content", async () => {
      const conceptualContent
        = "编程思想\n\n本文讨论面向对象编程的基本概念和设计模式原理";
      const conceptRefId = new ObjectId().toString();

      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: conceptRefId,
            refType: "post",
            content: conceptualContent,
          }),
        }),
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.sensitivity).toBe("low");

      // 清理
      await db_delete(DB_NAME, TIME_CAPSULES_COLLECTION, { refId: conceptRefId });
    });
  });

  describe("GET /ai/time-capsule/:refId", () => {
    it("should return stored analysis result", async () => {
      // 先创建一个分析结果
      await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: testRefId,
            refType: "post",
            content: testContent,
          }),
        }),
      );

      // 获取分析结果
      const response = await app.handle(
        new Request(`http://localhost/ai/time-capsule/${testRefId}`),
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.status).toBe("success");
      expect(data.data).toBeDefined();
      expect(data.data.sensitivity).toMatch(/^(high|medium|low)$/);
      expect(data.data.reason).toBeDefined();
      expect(data.data.markers).toBeInstanceOf(Array);
      expect(data.data.isNew).toBe(false);
    });

    it("should return 404 for non-existent analysis", async () => {
      const nonExistentId = new ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/ai/time-capsule/${nonExistentId}`),
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.code).toBe(404);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("not found");
    });

    it("should return 400 for invalid refId format", async () => {
      const response = await app.handle(
        new Request("http://localhost/ai/time-capsule/invalid-id"),
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.code).toBe(400);
      expect(data.status).toBe("failed");
      expect(data.message).toContain("Invalid refId");
    });
  });

  describe("Cache behavior", () => {
    it("should invalidate cache when content changes", async () => {
      const cacheRefId = new ObjectId().toString();
      const content1 = "原始内容";
      const content2 = "修改后的内容";

      // 第一次分析
      const response1 = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: cacheRefId,
            refType: "post",
            content: content1,
          }),
        }),
      );

      const data1 = await response1.json();
      expect(data1.data.isNew).toBe(true);

      // 第二次分析（内容不同）
      const response2 = await app.handle(
        new Request("http://localhost/ai/time-capsule/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refId: cacheRefId,
            refType: "post",
            content: content2,
          }),
        }),
      );

      const data2 = await response2.json();
      expect(data2.data.isNew).toBe(true); // 应该是新分析，因为内容变了

      // 清理
      await db_delete(DB_NAME, TIME_CAPSULES_COLLECTION, { refId: cacheRefId });
    });
  });
});
