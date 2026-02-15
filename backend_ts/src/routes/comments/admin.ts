import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_update } from "@/lib/db";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "comments";

/**
 * 评论管理员操作路由
 *
 * 提供以下端点：
 * - PATCH /comments/:id/pin - 置顶评论
 * - DELETE /comments/:id/pin - 取消置顶
 * - PATCH /comments/:id/hide - 隐藏评论
 * - DELETE /comments/:id/hide - 取消隐藏
 *
 * 所有操作都需要管理员权限
 */
export const adminRoutes = new Elysia()
  // PATCH /comments/:id/pin - 置顶评论
  .patch("/:id/pin", async ({ params, user, success, error, set }) => {
    try {
      if (!user || user.role !== "admin") {
        set.status = 403;
        return error(403, "Admin permission required");
      }

      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid comment ID format");
      }

      const updated = await db_update(
        DB_NAME,
        COLLECTION,
        { _id: new ObjectId(params.id) },
        { pin: true },
      );

      if (!updated) {
        set.status = 404;
        return error(404, "Comment not found");
      }

      return success({ message: "Comment pinned successfully" });
    } catch (err) {
      console.error("Error pinning comment:", err);
      set.status = 500;
      return error(500, "Failed to pin comment");
    }
  })

  // DELETE /comments/:id/pin - 取消置顶
  .delete("/:id/pin", async ({ params, user, success, error, set }) => {
    try {
      if (!user || user.role !== "admin") {
        set.status = 403;
        return error(403, "Admin permission required");
      }

      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid comment ID format");
      }

      const updated = await db_update(
        DB_NAME,
        COLLECTION,
        { _id: new ObjectId(params.id) },
        { pin: false },
      );

      if (!updated) {
        set.status = 404;
        return error(404, "Comment not found");
      }

      return success({ message: "Comment unpinned successfully" });
    } catch (err) {
      console.error("Error unpinning comment:", err);
      set.status = 500;
      return error(500, "Failed to unpin comment");
    }
  })

  // PATCH /comments/:id/hide - 隐藏评论
  .patch("/:id/hide", async ({ params, user, success, error, set }) => {
    try {
      if (!user || user.role !== "admin") {
        set.status = 403;
        return error(403, "Admin permission required");
      }

      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid comment ID format");
      }

      const updated = await db_update(
        DB_NAME,
        COLLECTION,
        { _id: new ObjectId(params.id) },
        { isWhispers: true },
      );

      if (!updated) {
        set.status = 404;
        return error(404, "Comment not found");
      }

      return success({ message: "Comment hidden successfully" });
    } catch (err) {
      console.error("Error hiding comment:", err);
      set.status = 500;
      return error(500, "Failed to hide comment");
    }
  })

  // DELETE /comments/:id/hide - 取消隐藏
  .delete("/:id/hide", async ({ params, user, success, error, set }) => {
    try {
      if (!user || user.role !== "admin") {
        set.status = 403;
        return error(403, "Admin permission required");
      }

      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid comment ID format");
      }

      const updated = await db_update(
        DB_NAME,
        COLLECTION,
        { _id: new ObjectId(params.id) },
        { isWhispers: false },
      );

      if (!updated) {
        set.status = 404;
        return error(404, "Comment not found");
      }

      return success({ message: "Comment unhidden successfully" });
    } catch (err) {
      console.error("Error unhiding comment:", err);
      set.status = 500;
      return error(500, "Failed to unhide comment");
    }
  });
