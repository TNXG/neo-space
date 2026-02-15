import { Elysia } from "elysia";
import { authMiddleware } from "@/middleware/auth";
import { paginationPlugin } from "@/plugins/pagination";
import { responsePlugin } from "@/plugins/response";
import { adminRoutes } from "./admin";
import { createComment } from "./create";
import { deleteComment } from "./delete";
import { listComments } from "./list";
import { updateComment } from "./update";

/**
 * Comments 路由主入口
 *
 * 提供以下端点：
 * - GET /comments - 获取评论列表
 * - POST /comments - 创建评论
 * - PUT /comments/:id - 更新评论
 * - DELETE /comments/:id - 删除评论
 * - PATCH /comments/:id/pin - 置顶评论（管理员）
 * - DELETE /comments/:id/pin - 取消置顶（管理员）
 * - PATCH /comments/:id/hide - 隐藏评论（管理员）
 * - DELETE /comments/:id/hide - 取消隐藏（管理员）
 */
export const commentsRoutes = new Elysia({ prefix: "/comments" })
  .use(paginationPlugin())
  .use(responsePlugin())
  .use(authMiddleware())
  .use(listComments)
  .use(createComment)
  .use(updateComment)
  .use(deleteComment)
  .use(adminRoutes);
