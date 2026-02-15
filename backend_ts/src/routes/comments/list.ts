import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_count, db_read } from "@/lib/db";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "comments";

/**
 * GET /comments - 获取评论列表
 *
 * 支持以下查询参数：
 * - page: 页码
 * - size: 每页数量
 * - refId: 关联内容 ID（文章/日记/页面）
 * - author: 作者名称
 * - status: 评论状态
 * - refType: 关联类型（post/note/page）
 */
export const listComments = new Elysia().get(
  "/",
  async ({ query, pagination, createPaginationMeta, paginated, error, set }) => {
    const { skip, size } = pagination;

    try {
      // 构建过滤器
      const filter: any = {};

      // 按 refId 过滤（文章/日记 ID）
      if (query.refId) {
        if (!ObjectId.isValid(query.refId)) {
          set.status = 400;
          return error(400, "Invalid refId format");
        }
        filter.refId = query.refId;
      }

      // 按作者过滤
      if (query.author) {
        filter.author = query.author;
      }

      // 按状态过滤
      if (query.status) {
        filter.status = query.status;
      }

      // 按 refType 过滤
      if (query.refType) {
        filter.refType = query.refType;
      }

      // 构建排序（默认按创建时间倒序）
      const sort: any = { created: -1 };

      // 查询数据
      const [comments, total] = await Promise.all([
        db_read(DB_NAME, COLLECTION, filter, { skip, limit: size, sort }),
        db_count(DB_NAME, COLLECTION, filter),
      ]);

      return paginated(comments, createPaginationMeta(total));
    } catch (err) {
      console.error("Error fetching comments:", err);
      set.status = 500;
      return error(500, "Failed to fetch comments");
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      size: t.Optional(t.String()),
      refId: t.Optional(t.String()),
      author: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal("pending"), t.Literal("approved"), t.Literal("spam")])),
      refType: t.Optional(t.Union([t.Literal("post"), t.Literal("note"), t.Literal("page")])),
    }),
  },
);
