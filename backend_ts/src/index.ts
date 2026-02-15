import { Elysia } from "elysia";
import { getConfig } from "@/config";
import { errorMiddleware } from "@/middleware/error";
import { categoriesRoutes } from "@/routes/categories";
import { configRoutes } from "@/routes/config";
import { linksRoutes } from "@/routes/links";
import { postsRoutes } from "@/routes/posts";
import { createIndexes } from "./lib/indexes";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { commentsRoutes } from "./routes/comments/index";
import { corsRoutes } from "./routes/cors";
import { nbnhhshRoutes } from "./routes/nbnhhsh";
import { notesRoutes } from "./routes/notes";
import { pagesRoutes } from "./routes/pages";
import { recentliesRoutes } from "./routes/recentlies";
import { sseRoutes } from "./routes/sse";
import { staticRoutes } from "./routes/static";
import { usersRoutes } from "./routes/users";
import { wsRoutes } from "./routes/ws";

const config = getConfig();

// 初始化数据库索引（静默模式）
createIndexes().catch(() => {
  // 索引创建失败不阻止应用启动
});

const app = new Elysia()
  .use(errorMiddleware())
  .get("/", () => ({ message: "API is running" }))
  .use(usersRoutes)
  .use(corsRoutes)
  .group("/api", app => app
    .use(postsRoutes)
    .use(categoriesRoutes)
    .use(notesRoutes)
    .use(linksRoutes)
    .use(recentliesRoutes)
    .use(pagesRoutes)
    .use(configRoutes)
    .use(aiRoutes)
    .use(commentsRoutes)
    .use(authRoutes)
    .use(nbnhhshRoutes)
    .use(sseRoutes)
    .use(wsRoutes)
    .use(staticRoutes))
  .listen({
    port: config.server.port,
    hostname: config.server.host,
  });

console.log(`\n🦊 Elysia 服务器运行在 ${app.server?.hostname}:${app.server?.port}\n`);

// 打印已注册的 API 路由
console.log("📋 已注册的 API 路由：\n");
console.log("  Posts API:");
console.log("    ✓ GET    /api/posts");
console.log("    ✓ GET    /api/posts/:id");
console.log("    ✓ GET    /api/posts/slug/:slug");
console.log("    ✓ GET    /api/posts/:id/adjacent");
console.log("");
console.log("  Notes API:");
console.log("    ✓ GET    /api/notes");
console.log("    ✓ GET    /api/notes/:id");
console.log("    ✓ GET    /api/notes/nid/:nid");
console.log("    ✓ GET    /api/notes/nid/:nid/adjacent");
console.log("");
console.log("  Categories API:");
console.log("    ✓ GET    /api/categories");
console.log("");
console.log("  Links API:");
console.log("    ✓ GET    /api/links");
console.log("    ✓ GET    /api/links/:id");
console.log("    ✓ POST   /api/links/apply");
console.log("    ✓ POST   /api/links/send-code");
console.log("");
console.log("  Users/Readers API:");
console.log("    ✓ GET    /api/user/profile");
console.log("    ✓ GET    /api/readers");
console.log("    ✓ GET    /api/readers/:id");
console.log("");
console.log("  Recentlies API:");
console.log("    ✓ GET    /api/recentlies");
console.log("");
console.log("  Pages API:");
console.log("    ✓ GET    /api/pages/:slug");
console.log("");
console.log("  Config API:");
console.log("    ✓ GET    /api/config");
console.log("");
console.log("  AI API:");
console.log("    ✓ POST   /api/ai/time-capsule/analyze");
console.log("    ✓ GET    /api/ai/time-capsule/:refId");
console.log("");
console.log("  Comments API:");
console.log("    ✓ GET    /api/comments");
console.log("    ✓ POST   /api/comments");
console.log("    ✓ PUT    /api/comments/:id");
console.log("    ✓ DELETE /api/comments/:id");
console.log("    ✓ PATCH  /api/comments/:id/pin");
console.log("    ✓ DELETE /api/comments/:id/pin");
console.log("    ✓ PATCH  /api/comments/:id/hide");
console.log("    ✓ DELETE /api/comments/:id/hide");
console.log("");
console.log("  Auth API:");
console.log("    ✓ GET    /api/auth/oauth/:provider");
console.log("    ✓ GET    /api/auth/oauth/:provider/callback");
console.log("    ✓ GET    /api/auth/me");
console.log("    ✓ GET    /api/auth/accounts");
console.log("    ✓ PUT    /api/auth/avatar");
console.log("    ✓ POST   /api/auth/bind-anonymous");
console.log("    ✓ POST   /api/auth/skip-bind");
console.log("    ✓ GET    /api/auth/bindable-identities");
console.log("");
console.log("  Tools API:");
console.log("    ✓ POST   /api/nbnhhsh/guess");
console.log("");
console.log("  Realtime API:");
console.log("    ✓ GET    /api/sse/reader");
console.log("    ✓ WS     /api/ws/owner-desktop");
console.log("");
console.log("  Static API:");
console.log("    ✓ GET    /api/static/artworks/:filename");
console.log("");
console.log("  CORS Test:");
console.log("    ✓ GET    /cors/:status");
console.log("\n");
