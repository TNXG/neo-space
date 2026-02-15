#!/usr/bin/env bun

/**
 * 数据库索引管理脚本
 * 
 * 用法:
 *   bun run scripts/manage-indexes.ts create  # 创建所有索引
 *   bun run scripts/manage-indexes.ts list    # 列出所有索引
 *   bun run scripts/manage-indexes.ts drop    # 删除所有索引（保留 _id）
 */

import { createIndexes, dropIndexes, listIndexes } from "../src/lib/indexes";

const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case "create":
        await createIndexes();
        break;

      case "list":
        await listIndexes();
        break;

      case "drop":
        console.log("警告：此操作将删除所有自定义索引（保留 _id 索引）");
        console.log("这会影响查询性能，仅建议在开发/测试环境使用");
        console.log("\n继续执行...\n");
        await dropIndexes();
        break;

      default:
        console.log("用法:");
        console.log("  bun run scripts/manage-indexes.ts create  # 创建所有索引");
        console.log("  bun run scripts/manage-indexes.ts list    # 列出所有索引");
        console.log("  bun run scripts/manage-indexes.ts drop    # 删除所有索引");
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error("执行失败:", error);
    process.exit(1);
  }
}

main();
