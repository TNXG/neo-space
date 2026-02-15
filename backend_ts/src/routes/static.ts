import { Elysia } from "elysia";
import { existsSync } from "fs";
import { join } from "path";

/**
 * 静态资源路由
 *
 * 提供以下端点：
 * - GET /static/artworks/:filename - 获取封面图片
 */
export const staticRoutes = new Elysia({ prefix: "/static" })
  // GET /static/artworks/:filename - 获取封面图片
  .get("/artworks/:filename", async ({ params, set }) => {
    try {
      const { filename } = params;

      // 安全检查：防止路径遍历攻击
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        set.status = 400;
        return { error: "Invalid filename" };
      }

      // 构建文件路径
      const filePath = join(process.cwd(), "cache", "artworks", filename);

      // 检查文件是否存在
      if (!existsSync(filePath)) {
        set.status = 404;
        return { error: "File not found" };
      }

      // 确定 Content-Type
      let contentType = "image/jpeg";
      if (filename.endsWith(".png")) {
        contentType = "image/png";
      } else if (filename.endsWith(".webp")) {
        contentType = "image/webp";
      } else if (filename.endsWith(".gif")) {
        contentType = "image/gif";
      }

      // 读取文件
      const file = Bun.file(filePath);

      // 设置响应头
      set.headers["Content-Type"] = contentType;
      set.headers["Cache-Control"] = "public, max-age=31536000"; // 缓存 1 年

      return file;
    } catch (err) {
      console.error("Error serving artwork:", err);
      set.status = 500;
      return { error: "Failed to serve artwork" };
    }
  });
