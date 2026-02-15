import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mongoClient } from "@/lib/db";

describe("MongoDB Connection Pool", () => {
  let client: any;

  beforeAll(async () => {
    client = await mongoClient();
  });

  afterAll(async () => {
    // 不关闭客户端，因为它是共享的
  });

  it("should create a connection pool with configured min and max sizes", async () => {
    expect(client).toBeDefined();
    expect(client.options).toBeDefined();

    // 验证连接池配置
    const options = client.options;
    expect(options.maxPoolSize).toBeGreaterThanOrEqual(5);
    expect(options.minPoolSize).toBeGreaterThanOrEqual(1);

    console.log(`Connection pool configured: min=${options.minPoolSize}, max=${options.maxPoolSize}`);
  });

  it("should reuse the same client instance on multiple calls", async () => {
    const client1 = await mongoClient();
    const client2 = await mongoClient();

    // 应该返回同一个客户端实例
    expect(client1).toBe(client2);
  });

  it("should successfully ping the database", async () => {
    const result = await client.db().admin().ping();
    expect(result).toBeDefined();
    expect(result.ok).toBe(1);
  });

  it("should handle concurrent database operations", async () => {
    const db = client.db("mx-space");
    const collection = db.collection("test_connection_pool");

    // 创建多个并发操作
    const operations = Array.from({ length: 10 }, (_, i) =>
      collection.insertOne({ test: `concurrent_${i}`, timestamp: new Date() }));

    // 执行并发操作
    const results = await Promise.all(operations);

    // 验证所有操作都成功
    expect(results).toHaveLength(10);
    results.forEach((result) => {
      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBeDefined();
    });

    // 清理测试数据
    await collection.deleteMany({ test: /^concurrent_/ });
  });

  it("should maintain connection pool under load", async () => {
    const db = client.db("mx-space");
    const collection = db.collection("test_connection_pool");

    // 模拟高负载场景
    const batchSize = 20;
    const batches = 3;

    for (let batch = 0; batch < batches; batch++) {
      const operations = Array.from({ length: batchSize }, (_, i) =>
        collection.findOne({ test: `load_test_${batch}_${i}` }));

      const results = await Promise.all(operations);
      expect(results).toHaveLength(batchSize);
    }

    // 验证连接仍然有效
    const pingResult = await client.db().admin().ping();
    expect(pingResult.ok).toBe(1);
  });
});
