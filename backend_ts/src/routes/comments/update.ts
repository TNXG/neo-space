import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_findById, db_update } from "@/lib/db";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "comments";

/**
 * PUT /comments/:id - 更新评论
 *
 * 权限验证：
 * - 只有作者或管理员可以修改评论
 * - 只有管理员可以修改评论状态
 *
 * 可更新字段：
 * - text: 评论内容
 * - status: 评论状态（仅管理员）
 */
export const updateComment = new Elysia().put(
  "/:id",
  async ({ params, body, user, success, error, set }) => {
    try {
      // 验证 ID 格式
      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid comment ID format");
      }

      // 查询评论
      const comment = await db_findById(DB_NAME, COLLECTION, params.id);

      if (!comment) {
        set.status = 404;
        return error(404, "Comment not found");
      }

      // 权限验证：只有作者或管理员可以修改
      if (!user) {
        set.status = 401;
        return error(401, "Authentication required");
      }

      const isAuthor = comment.mail === user.email;
      const isAdmin = user.role === "admin";

      if (!isAuthor && !isAdmin) {
        set.status = 403;
        return error(403, "Permission denied: only author or admin can update this comment");
      }

      // 构建更新数据
      const updateData: any = {};

      if (body.text !== undefined) {
        updateData.text = body.text;
      }

      if (body.status !== undefined && isAdmin) {
        // 只有管理员可以修改状态
        updateData.status = body.status;
      }

      // 更新评论
      const updated = await db_update(
        DB_NAME,
        COLLECTION,
        { _id: new ObjectId(params.id) },
        updateData,
      );

      if (!updated) {
        set.status = 500;
        return error(500, "Failed to update comment");
      }

      // 返回更新后的评论
      const updatedComment = await db_findById(DB_NAME, COLLECTION, params.id);
      return success(updatedComment);
    } catch (err) {
      console.error("Error updating comment:", err);
      set.status = 500;
      return error(500, "Failed to update comment");
    }
  },
  {
    body: t.Object({
      text: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal("pending"), t.Literal("approved"), t.Literal("spam")])),
    }),
  },
);
