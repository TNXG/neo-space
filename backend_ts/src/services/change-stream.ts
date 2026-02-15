/**
 * Change Stream 监听服务 - MongoDB 变更监听与自动缓存失效
 * 对标 Rust backend 的 ChangeStreamService
 */

import type { ChangeStream, ChangeStreamDocument, Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getCacheService, CacheKey } from "./cache";
import { getRevalidationService } from "./revalidation";

export class ChangeStreamService {
  private changeStream: ChangeStream | null = null;
  private isRunning = false;

  /**
   * 启动 Change Stream 监听（带自动重连）
   */
  async startWatching(): Promise<void> {
    console.log("[ChangeStream] 启动 MongoDB Change Stream 监听服务...");

    while (true) {
      try {
        await this.watchCollections();
        console.warn("[ChangeStream] Change Stream 正常结束，准备重新连接...");
      } catch (error) {
        console.error("[ChangeStream] Change Stream 错误:", error);
        console.log("[ChangeStream] 5秒后尝试重新连接...");
      }

      // 等待后重连
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  /**
   * 监听集合变更
   */
  private async watchCollections(): Promise<void> {
    const db = await getDb();

    // 配置 Change Stream 选项
    const pipeline = [
      {
        $match: {
          operationType: { $in: ["insert", "update", "replace", "delete"] },
          "ns.coll": { $in: ["posts", "notes", "pages", "categories", "links"] },
        },
      },
    ];

    console.log("[ChangeStream] 正在建立 Change Stream 连接...");

    this.changeStream = db.watch(pipeline, {
      fullDocument: "updateLookup",
    });

    this.isRunning = true;
    console.log("[ChangeStream] ✓ Change Stream 连接成功，开始监听数据变更");

    // 持续监听变更事件
    for await (const event of this.changeStream) {
      await this.handleChangeEvent(event);
    }
  }

  /**
   * 处理变更事件
   */
  private async handleChangeEvent(event: ChangeStreamDocument<Document>): Promise<void> {
    const operationType = event.operationType;
    const collectionName = event.ns?.coll || "unknown";

    console.log(`[ChangeStream] 检测到数据变更 - 集合: ${collectionName}, 操作: ${operationType}`);

    const cache = getCacheService();
    const revalidation = getRevalidationService();

    try {
      switch (collectionName) {
        case "posts":
          await this.handlePostsChange(event, cache, revalidation);
          break;
        case "notes":
          await this.handleNotesChange(event, cache, revalidation);
          break;
        case "pages":
          await this.handlePagesChange(event, cache, revalidation);
          break;
        case "categories":
          await this.handleCategoriesChange(cache, revalidation);
          break;
        case "links":
          await this.handleLinksChange(cache, revalidation);
          break;
        default:
          console.warn(`[ChangeStream] 未处理的集合: ${collectionName}`);
      }
    } catch (error) {
      console.error(`[ChangeStream] 处理变更事件失败:`, error);
    }
  }

  /**
   * 处理 Posts 变更
   */
  private async handlePostsChange(
    event: ChangeStreamDocument<Document>,
    cache: ReturnType<typeof getCacheService>,
    revalidation: ReturnType<typeof getRevalidationService> | null
  ): Promise<void> {
    // 清除所有 posts 相关缓存
    await cache.invalidateByPrefix(CacheKey.Post);
    await cache.invalidateByPrefix(CacheKey.PostList);

    console.log("[ChangeStream] ✓ Posts 缓存已清除");

    // 触发 ISR 重新验证
    if (revalidation) {
      try {
        await revalidation.revalidateBoth("posts", "/posts");

        // 如果是更新或删除，重新验证具体文章
        if (event.operationType !== "insert" && event.documentKey) {
          const postId = event.documentKey._id?.toString();
          if (postId) {
            await revalidation.revalidatePath(`/posts/${postId}`);
          }
        }
      } catch (error) {
        console.error("[ChangeStream] ISR 重新验证失败:", error);
      }
    }
  }

  /**
   * 处理 Notes 变更
   */
  private async handleNotesChange(
    event: ChangeStreamDocument<Document>,
    cache: ReturnType<typeof getCacheService>,
    revalidation: ReturnType<typeof getRevalidationService> | null
  ): Promise<void> {
    await cache.invalidateByPrefix(CacheKey.Note);
    await cache.invalidateByPrefix(CacheKey.NoteList);

    console.log("[ChangeStream] ✓ Notes 缓存已清除");

    if (revalidation) {
      try {
        await revalidation.revalidateBoth("notes", "/notes");

        if (event.operationType !== "insert" && event.documentKey) {
          const noteId = event.documentKey._id?.toString();
          if (noteId) {
            await revalidation.revalidatePath(`/notes/${noteId}`);
          }
        }
      } catch (error) {
        console.error("[ChangeStream] ISR 重新验证失败:", error);
      }
    }
  }

  /**
   * 处理 Pages 变更
   */
  private async handlePagesChange(
    event: ChangeStreamDocument<Document>,
    cache: ReturnType<typeof getCacheService>,
    revalidation: ReturnType<typeof getRevalidationService> | null
  ): Promise<void> {
    await cache.invalidateByPrefix(CacheKey.Page);

    console.log("[ChangeStream] ✓ Pages 缓存已清除");

    if (revalidation) {
      try {
        await revalidation.revalidateTag("pages");

        // 重新验证具体页面
        if (event.fullDocument?.slug) {
          await revalidation.revalidatePath(`/${event.fullDocument.slug}`);
        }
      } catch (error) {
        console.error("[ChangeStream] ISR 重新验证失败:", error);
      }
    }
  }

  /**
   * 处理 Categories 变更
   */
  private async handleCategoriesChange(
    cache: ReturnType<typeof getCacheService>,
    revalidation: ReturnType<typeof getRevalidationService> | null
  ): Promise<void> {
    await cache.invalidate(CacheKey.Categories);

    console.log("[ChangeStream] ✓ Categories 缓存已清除");

    if (revalidation) {
      try {
        await revalidation.revalidateTag("categories");
      } catch (error) {
        console.error("[ChangeStream] ISR 重新验证失败:", error);
      }
    }
  }

  /**
   * 处理 Links 变更
   */
  private async handleLinksChange(
    cache: ReturnType<typeof getCacheService>,
    revalidation: ReturnType<typeof getRevalidationService> | null
  ): Promise<void> {
    await cache.invalidateByPrefix(CacheKey.Link);

    console.log("[ChangeStream] ✓ Links 缓存已清除");

    if (revalidation) {
      try {
        await revalidation.revalidateBoth("links", "/links");
      } catch (error) {
        console.error("[ChangeStream] ISR 重新验证失败:", error);
      }
    }
  }

  /**
   * 停止监听
   */
  async stop(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.isRunning = false;
      console.log("[ChangeStream] Change Stream 已停止");
    }
  }

  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// 单例实例
let changeStreamServiceInstance: ChangeStreamService | null = null;

export function getChangeStreamService(): ChangeStreamService {
  if (!changeStreamServiceInstance) {
    changeStreamServiceInstance = new ChangeStreamService();
  }
  return changeStreamServiceInstance;
}

/**
 * 启动 Change Stream 监听（后台任务）
 */
export async function startChangeStreamWatcher(): Promise<void> {
  const service = getChangeStreamService();

  // 在后台启动监听
  service.startWatching().catch((error) => {
    console.error("[ChangeStream] 启动失败:", error);
  });

  console.log("[ChangeStream] ✓ Change Stream 监听已在后台启动");
}
