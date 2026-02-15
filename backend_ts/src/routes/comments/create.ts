import type { Comment } from "@/types/models";
import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_findById, db_insert } from "@/lib/db";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "comments";

/**
 * POST /comments - 创建评论
 *
 * 必填字段：
 * - author: 作者名称
 * - email: 邮箱
 * - text: 评论内容
 * - refId: 关联内容 ID
 * - refType: 关联类型（post/note/page）
 *
 * 可选字段：
 * - parentId: 父评论 ID（用于回复）
 * - avatar: 头像 URL
 * - ip: IP 地址
 * - userAgent: 用户代理
 */
export const createComment = new Elysia().post(
  "/",
  async ({ body, success, error, set }) => {
    try {
      // 验证必填字段
      if (!body.author || !body.email || !body.text || !body.refId || !body.refType) {
        set.status = 400;
        return error(400, "Missing required fields: author, email, text, refId, refType");
      }

      // 验证 refId 格式
      if (!ObjectId.isValid(body.refId)) {
        set.status = 400;
        return error(400, "Invalid refId format");
      }

      // 如果有 parentId，验证父评论是否存在
      if (body.parentId) {
        if (!ObjectId.isValid(body.parentId)) {
          set.status = 400;
          return error(400, "Invalid parentId format");
        }

        const parentComment = await db_findById(DB_NAME, COLLECTION, body.parentId);
        if (!parentComment) {
          set.status = 404;
          return error(404, "Parent comment not found");
        }
      }

      // 构建评论对象
      const comment: Partial<Comment> = {
        author: body.author,
        mail: body.email,
        avatar: body.avatar,
        text: body.text,
        refId: body.refId,
        refType: body.refType,
        parentId: body.parentId,
        created: new Date(),
        status: "pending", // 默认状态为待审核
        ip: body.ip,
        userAgent: body.userAgent,
      };

      // 插入评论
      const inserted = await db_insert(DB_NAME, COLLECTION, comment);

      if (!inserted) {
        set.status = 500;
        return error(500, "Failed to create comment");
      }

      // TODO: 通过 SSE 通知相关方（需要先实现 EventBus）
      // eventBus.broadcastSSE("new_comment", { refId: body.refId, refType: body.refType });

      set.status = 201;
      return success(comment, 201);
    } catch (err) {
      console.error("Error creating comment:", err);
      set.status = 500;
      return error(500, "Failed to create comment");
    }
  },
  {
    body: t.Object({
      author: t.String(),
      email: t.String(),
      avatar: t.Optional(t.String()),
      text: t.String(),
      refId: t.String(),
      refType: t.Union([t.Literal("post"), t.Literal("note"), t.Literal("page")]),
      parentId: t.Optional(t.String()),
      ip: t.Optional(t.String()),
      userAgent: t.Optional(t.String()),
    }),
  },
);
