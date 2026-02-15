import { mongoClient } from "./db";

/**
 * 数据库索引配置
 * 为常用查询字段创建索引以提升查询性能
 */

interface IndexDefinition {
  collection: string;
  indexes: Array<{
    key: Record<string, 1 | -1>;
    options?: {
      unique?: boolean;
      name?: string;
      sparse?: boolean;
    };
  }>;
}

const DB_NAME = "mx-space";

/**
 * 索引定义
 * 根据 Requirements 20.2 和任务 18.5 的要求创建索引
 */
const indexDefinitions: IndexDefinition[] = [
  // Posts 集合索引
  {
    collection: "posts",
    indexes: [
      // 单字段索引
      { key: { slug: 1 }, options: { unique: true, name: "idx_posts_slug" } },
      { key: { categoryId: 1 }, options: { name: "idx_posts_categoryId" } },
      { key: { tags: 1 }, options: { name: "idx_posts_tags" } },
      { key: { isPublished: 1 }, options: { name: "idx_posts_isPublished" } },
      { key: { created: -1 }, options: { name: "idx_posts_created" } },
      // 复合索引 - 用于分页查询（已发布文章按创建时间倒序）
      {
        key: { isPublished: 1, created: -1 },
        options: { name: "idx_posts_published_created" },
      },
    ],
  },

  // Notes 集合索引
  {
    collection: "notes",
    indexes: [
      // 单字段索引
      { key: { nid: 1 }, options: { unique: true, name: "idx_notes_nid" } },
      { key: { isPublished: 1 }, options: { name: "idx_notes_isPublished" } },
      { key: { created: -1 }, options: { name: "idx_notes_created" } },
      // 复合索引 - 用于分页查询（已发布日记按创建时间倒序）
      {
        key: { isPublished: 1, created: -1 },
        options: { name: "idx_notes_published_created" },
      },
    ],
  },

  // Categories 集合索引
  {
    collection: "categories",
    indexes: [
      { key: { slug: 1 }, options: { unique: true, name: "idx_categories_slug" } },
      { key: { type: 1 }, options: { name: "idx_categories_type" } },
    ],
  },

  // Links 集合索引
  {
    collection: "links",
    indexes: [
      { key: { status: 1 }, options: { name: "idx_links_status" } },
      { key: { created: -1 }, options: { name: "idx_links_created" } },
    ],
  },

  // Comments 集合索引
  {
    collection: "comments",
    indexes: [
      // 单字段索引
      { key: { refId: 1 }, options: { name: "idx_comments_refId" } },
      { key: { refType: 1 }, options: { name: "idx_comments_refType" } },
      { key: { parentId: 1 }, options: { name: "idx_comments_parentId", sparse: true } },
      { key: { status: 1 }, options: { name: "idx_comments_status" } },
      { key: { created: -1 }, options: { name: "idx_comments_created" } },
      // 复合索引 - 用于查询特定资源的评论（按创建时间倒序）
      {
        key: { refId: 1, refType: 1, created: -1 },
        options: { name: "idx_comments_ref_created" },
      },
    ],
  },

  // Pages 集合索引
  {
    collection: "pages",
    indexes: [
      { key: { slug: 1 }, options: { unique: true, name: "idx_pages_slug" } },
      { key: { order: 1 }, options: { name: "idx_pages_order" } },
    ],
  },

  // Users 集合索引
  {
    collection: "users",
    indexes: [
      { key: { email: 1 }, options: { unique: true, name: "idx_users_email" } },
      { key: { username: 1 }, options: { unique: true, name: "idx_users_username" } },
    ],
  },

  // Recentlies 集合索引
  {
    collection: "recentlies",
    indexes: [
      { key: { created: -1 }, options: { name: "idx_recentlies_created" } },
      { key: { type: 1 }, options: { name: "idx_recentlies_type" } },
    ],
  },
];

/**
 * 创建所有索引
 * 如果索引已存在则跳过
 * 如果集合不存在则跳过
 */
export async function createIndexes(): Promise<void> {
  const client = await mongoClient();
  const db = client.db(DB_NAME);

  for (const { collection: collectionName, indexes } of indexDefinitions) {
    const collection = db.collection(collectionName);

    try {
      // 检查集合是否存在
      const collections = await db.listCollections({ name: collectionName }).toArray();
      if (collections.length === 0) {
        continue;
      }

      // 获取现有索引
      const existingIndexes = await collection.indexes();
      const existingIndexNames = new Set(existingIndexes.map(idx => idx.name));

      for (const { key, options } of indexes) {
        const indexName = options?.name || Object.keys(key).join("_");

        if (existingIndexNames.has(indexName)) {
          continue;
        }

        try {
          await collection.createIndex(key, options);
        } catch (error) {
          // 静默失败，索引可能已存在或有冲突
        }
      }
    } catch (error) {
      // 静默失败
    }
  }
}

/**
 * 列出所有集合的索引
 */
export async function listIndexes(): Promise<void> {
  console.log("数据库索引列表:\n");

  const client = await mongoClient();
  const db = client.db(DB_NAME);

  for (const { collection: collectionName } of indexDefinitions) {
    console.log(`集合: ${collectionName}`);
    const collection = db.collection(collectionName);

    try {
      // 检查集合是否存在
      const collections = await db.listCollections({ name: collectionName }).toArray();
      if (collections.length === 0) {
        console.log(`  ⊘ 集合不存在\n`);
        continue;
      }

      const indexes = await collection.indexes();
      for (const index of indexes) {
        const keys = Object.entries(index.key)
          .map(([field, order]) => `${field}: ${order}`)
          .join(", ");
        const unique = index.unique ? " [UNIQUE]" : "";
        const sparse = index.sparse ? " [SPARSE]" : "";
        console.log(`  - ${index.name}: { ${keys} }${unique}${sparse}`);
      }
    } catch (error) {
      console.error(`  ✗ 获取索引失败:`, error);
    }

    console.log();
  }
}

/**
 * 删除所有自定义索引（保留 _id 索引）
 * 警告：此操作会影响查询性能，仅用于开发/测试环境
 */
export async function dropIndexes(): Promise<void> {
  console.log("开始删除数据库索引...\n");

  const client = await mongoClient();
  const db = client.db(DB_NAME);

  for (const { collection: collectionName } of indexDefinitions) {
    console.log(`处理集合: ${collectionName}`);
    const collection = db.collection(collectionName);

    try {
      const indexes = await collection.indexes();

      for (const index of indexes) {
        // 跳过 _id 索引（无法删除）
        if (index.name === "_id_") {
          continue;
        }

        try {
          await collection.dropIndex(index.name || "");
          console.log(`  ✓ 删除索引: ${index.name}`);
        } catch (error) {
          console.error(`  ✗ 删除索引失败: ${index.name}`, error);
        }
      }
    } catch (error) {
      console.error(`  ✗ 获取索引失败:`, error);
    }

    console.log();
  }

  console.log("索引删除完成！");
}
