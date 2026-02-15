import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_delete, db_findById } from "@/lib/db";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "comments";

/**
 * DELETE /comments/:id - 删除评论
 *
 * 权限验证：
 * - 只有作者或管理员可以删除评论
 */
export const deleteComment = new Elysia().delete("/:id", async ({ params, user, success, error, set }) => {
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

    // 权限验证：只有作者或管理员可以删除
    if (!user) {
      set.status = 401;
      return error(401, "Authentication required");
    }

    const isAuthor = comment.mail === user.email;
    const isAdmin = user.role === "admin";

    if (!isAuthor && !isAdmin) {
      set.status = 403;
      return error(403, "Permission denied: only author or admin can delete this comment");
    }

    // 删除评论
    const deleted = await db_delete(DB_NAME, COLLECTION, { _id: new ObjectId(params.id) });

    if (!deleted) {
      set.status = 500;
      return error(500, "Failed to delete comment");
    }

    set.status = 204;
    return success(null, 204);
  } catch (err) {
    console.error("Error deleting comment:", err);
    set.status = 500;
    return error(500, "Failed to delete comment");
  }
});
