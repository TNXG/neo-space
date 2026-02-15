import { MongoClient, ObjectId } from "mongodb";
import { getConfig } from "@/config";

let cachedClient: MongoClient | null = null;
let connectionPromise: Promise<MongoClient> | null = null;

/**
 * 创建并返回一个复用的 MongoDB 客户端实例。
 * @returns {Promise<MongoClient>} MongoDB 客户端实例
 */
export async function mongoClient(): Promise<MongoClient> {
  // 检查缓存的客户端是否仍然有效
  if (cachedClient) {
    try {
      // 使用 ping 命令检查连接状态，而不是已弃用的 topology 属性
      await cachedClient.db().admin().ping();
      return cachedClient;
    } catch {
      // 连接失效，清理缓存
      cachedClient = null;
    }
  }

  // 如果正在连接中，返回同一个Promise避免重复连接
  if (connectionPromise) {
    return connectionPromise;
  }

  const AppConfig = getConfig();
  let uri: string;

  // 优先使用 MONGODB_URI
  if (AppConfig.mongodb.uri) {
    uri = AppConfig.mongodb.uri;
  } else {
    // 使用单独的配置项构建 URI
    const host = AppConfig.mongodb.host || "127.0.0.1";
    const port = AppConfig.mongodb.port || 27017;
    const user = AppConfig.mongodb.user;
    const password = AppConfig.mongodb.password;
    const directConnection = AppConfig.mongodb.directConnection !== false;

    if (user && password) {
      uri = `mongodb://${user}:${password}@${host}:${port}/?directConnection=${directConnection}`;
    } else {
      uri = `mongodb://${host}:${port}/?directConnection=${directConnection}`;
    }
  }

  connectionPromise = (async () => {
    const client = new MongoClient(uri, {
      maxPoolSize: AppConfig.mongodb.poolSize?.max || 50,
      minPoolSize: AppConfig.mongodb.poolSize?.min || 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      monitorCommands: true,
    });

    try {
      await connectWithTimeout(client);
      cachedClient = client;
      return client;
    } catch (error) {
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

/**
 * 带有超时机制的连接函数。
 * @param {MongoClient} client - MongoDB 客户端实例
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<void>} 连接成功或超时错误
 */
async function connectWithTimeout(client: MongoClient, timeout: number = 20000): Promise<void> {
  return Promise.race<void>([
    client.connect().then(() => undefined),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error("连接数据库超时")), timeout)),
  ]).catch((error: unknown) => {
    throw error instanceof Error ? error : new Error(String(error));
  });
}

/**
 * 检查数据库是否存在。
 * @param {string} dbName - 数据库名称
 * @returns {Promise<boolean>} 如果数据库存在则返回 true，否则返回 false
 */
export async function check_db(dbName: string): Promise<boolean> {
  const client = await mongoClient();
  try {
    const dblist = await client.db().admin().listDatabases();
    return dblist.databases.some(db => db.name === dbName);
  } catch (error) {
    console.error(`检查数据库时出错: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 从数据库中读取数据。
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {object} [filter] - 查询过滤器
 * @param {object} [options] - 查询选项，包括分页和排序
 * @returns {Promise<Array>} 返回查询到的数据数组
 */
export async function db_read(dbName: string, collectionName: string, filter: object = {}, options: object = {}): Promise<any[]> {
  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const cursor = collection.find(filter, options);
    const results = await cursor.toArray();
    // 立即关闭游标释放资源
    await cursor.close();
    return results;
  } catch {
    return [];
  }
}

/**
 * 向数据库中插入数据。
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {object} data - 要插入的数据
 * @returns {Promise<boolean>} 如果插入成功则返回 true
 */
export async function db_insert(dbName: string, collectionName: string, data: object): Promise<boolean> {
  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    await collection.insertOne(data);
    return true;
  } catch (error) {
    console.error(`插入数据时出错: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 在数据库中查找数据。
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {object} data - 查找条件
 * @returns {Promise<object | null>} 返回查找到的数据，如果没有找到则返回 null
 */
export async function db_find(dbName: string, collectionName: string, data: object): Promise<any | null> {
  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.findOne(data);
  } catch (error) {
    console.error(`查找数据时出错: ${(error as Error).message}`);
    return null;
  }
}

/**
 * 根据 MongoDB ObjectId 查找单条记录
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {string} id - ObjectId 字符串
 * @returns {Promise<any | null>} 返回查找到的文档，如果没有找到则返回 null
 */
export async function db_findById(dbName: string, collectionName: string, id: string): Promise<any | null> {
  // 验证 ObjectId 格式
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.findOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.error(`根据 ID 查找数据时出错: ${(error as Error).message}`);
    return null;
  }
}

/**
 * 更新数据库中的数据。
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {object} query - 查询条件
 * @param {object} data - 更新的数据
 * @returns {Promise<boolean>} 如果更新成功则返回 true
 */
export async function db_update(dbName: string, collectionName: string, query: object, data: object): Promise<boolean> {
  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // 检查data是否已经包含MongoDB更新操作符
    const hasUpdateOperators = Object.keys(data).some(key => key.startsWith("$"));

    if (hasUpdateOperators) {
      // 如果包含更新操作符，直接使用data
      await collection.updateOne(query, data);
    } else {
      // 如果不包含更新操作符，使用$set包装
      await collection.updateOne(query, { $set: data });
    }

    return true;
  } catch (error) {
    console.error(`更新数据时出错: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 删除数据库中的数据。
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {object} query - 删除条件
 * @returns {Promise<boolean>} 如果删除成功则返回 true
 */
export async function db_delete(dbName: string, collectionName: string, query: object): Promise<boolean> {
  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    await collection.deleteOne(query);
    return true;
  } catch (error) {
    console.error(`删除数据时出错: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 获取数据库中某一集合的文档总数
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {object} [filter] - 查询过滤器
 * @returns {Promise<number>} 返回集合中的文档总数
 */
export async function db_count(dbName: string, collectionName: string, filter: object = {}): Promise<number> {
  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.countDocuments(filter);
  } catch (error) {
    console.error(`获取文档总数时出错: ${(error as Error).message}`);
    return 0;
  }
}

/**
 * 从数据库中获取某个字段的所有唯一值
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {string} fieldName - 需要获取唯一值的字段名
 * @returns {Promise<Array>} 返回包含所有唯一字段值的数组
 */
export async function db_getUniqueFieldValues(dbName: string, collectionName: string, fieldName: string): Promise<any[]> {
  const client = await mongoClient();
  let cursor;
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    cursor = collection.aggregate([
      { $match: { [fieldName]: { $exists: true } } },
      { $group: { _id: `$${fieldName}` } },
      { $project: { _id: 0, value: "$_id" } },
    ]);
    const result = await cursor.toArray();
    return result.map(item => item.value);
  } catch (error) {
    console.error(`获取唯一字段值时出错: ${(error as Error).message}`);
    return [];
  } finally {
    // 确保关闭游标
    if (cursor) {
      await cursor.close();
    }
  }
}

// 缓存已初始化的 TTL 索引集合
const ttlIndexInitialized = new Set<string>();

/**
 * 确保集合具有 TTL 索引（用于自动过期删除）
 * @param {string} dbName - 数据库名称
 * @param {string} collectionName - 集合名称
 * @param {string} fieldName - 时间字段名
 * @param {number} expireAfterSeconds - 过期时间（秒）
 */
export async function ensureTTLIndex(
  dbName: string,
  collectionName: string,
  fieldName: string,
  expireAfterSeconds: number,
): Promise<void> {
  const cacheKey = `${dbName}.${collectionName}.${fieldName}`;
  if (ttlIndexInitialized.has(cacheKey)) {
    return;
  }

  const client = await mongoClient();
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // 检查索引是否已存在
    const indexes = await collection.indexes();
    const ttlIndexExists = indexes.some(
      idx => idx.key?.[fieldName] === 1 && idx.expireAfterSeconds !== undefined,
    );

    if (!ttlIndexExists) {
      await collection.createIndex(
        { [fieldName]: 1 },
        { expireAfterSeconds },
      );
    }

    ttlIndexInitialized.add(cacheKey);
  } catch (error) {
    console.error(`创建 TTL 索引时出错: ${(error as Error).message}`);
  }
}
