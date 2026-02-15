import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_count, db_find, db_findById, db_read } from "@/lib/db";
import { paginationPlugin } from "@/plugins/pagination";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const COLLECTION = "notes";

/**
 * Notes 路由处理器
 *
 * 提供以下端点：
 * - GET /notes - 获取日记列表（支持分页、过滤、排序）
 * - GET /notes/:id - 根据 ID 获取日记
 * - GET /notes/nid/:nid - 根据 nid 获取日记
 * - GET /notes/:nid/adjacent - 获取相邻日记
 */
export const notesRoutes = new Elysia({ prefix: "/notes" })
  .use(paginationPlugin())
  .use(responsePlugin())

  // GET /notes - 列表
  .get(
    "/",
    async ({ query, pagination, createPaginationMeta, paginated, error, set }) => {
      const { size, skip } = pagination;

      try {
        // 构建过滤器
        const filter: any = { isPublished: true };

        // 心情过滤
        if (query.mood) {
          filter.mood = query.mood;
        }

        // 天气过滤
        if (query.weather) {
          filter.weather = query.weather;
        }

        // 构建排序
        const sort: any = {};
        if (query.sortBy === "created") {
          sort.created = query.order === "asc" ? 1 : -1;
        } else if (query.sortBy === "nid") {
          sort.nid = query.order === "asc" ? 1 : -1;
        } else {
          // 默认按创建时间倒序
          sort.created = -1;
        }

        // 查询数据
        const [notes, total] = await Promise.all([
          db_read(DB_NAME, COLLECTION, filter, { skip, limit: size, sort }),
          db_count(DB_NAME, COLLECTION, filter),
        ]);

        return paginated(notes, createPaginationMeta(total));
      } catch (err) {
        console.error("Error fetching notes:", err);
        set.status = 500;
        return error(500, "Failed to fetch notes");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        size: t.Optional(t.String()),
        mood: t.Optional(t.String()),
        weather: t.Optional(t.String()),
        sortBy: t.Optional(t.Union([t.Literal("created"), t.Literal("nid")])),
        order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
      }),
    },
  )

  // GET /notes/nid/:nid - 根据 nid 获取
  // 注意：这个路由必须在 /:id 之前定义，否则 "nid" 会被当作 ID 处理
  .get("/nid/:nid", async ({ params, success, error, set }) => {
    try {
      // 验证 nid 格式（应该是数字）
      const nid = Number.parseInt(params.nid);
      if (Number.isNaN(nid)) {
        set.status = 400;
        return error(400, "Invalid nid format");
      }

      const note = await db_find(DB_NAME, COLLECTION, { nid });

      if (!note) {
        set.status = 404;
        return error(404, "Note not found");
      }

      return success(note);
    } catch (err) {
      console.error("Error fetching note by nid:", err);
      set.status = 500;
      return error(500, "Failed to fetch note");
    }
  })

  // GET /notes/nid/:nid/adjacent - 获取相邻日记（使用 nid）
  .get("/nid/:nid/adjacent", async ({ params, success, error, set }) => {
    try {
      // 验证 nid 格式（应该是数字）
      const nid = Number.parseInt(params.nid);
      if (Number.isNaN(nid)) {
        set.status = 400;
        return error(400, "Invalid nid format");
      }

      const currentNote = await db_find(DB_NAME, COLLECTION, { nid });

      if (!currentNote) {
        set.status = 404;
        return error(404, "Note not found");
      }

      // 查询相邻日记
      const [prevResults, nextResults] = await Promise.all([
        // 上一篇：创建时间小于当前日记，按创建时间倒序，取第一条
        db_read(
          DB_NAME,
          COLLECTION,
          { created: { $lt: currentNote.created }, isPublished: true },
          { sort: { created: -1 }, limit: 1 },
        ),
        // 下一篇：创建时间大于当前日记，按创建时间升序，取第一条
        db_read(
          DB_NAME,
          COLLECTION,
          { created: { $gt: currentNote.created }, isPublished: true },
          { sort: { created: 1 }, limit: 1 },
        ),
      ]);

      return success({
        prev: prevResults[0] || null,
        next: nextResults[0] || null,
      });
    } catch (err) {
      console.error("Error fetching adjacent notes:", err);
      set.status = 500;
      return error(500, "Failed to fetch adjacent notes");
    }
  })

  // GET /notes/:id - 根据 ID 获取
  .get("/:id", async ({ params, success, error, set }) => {
    try {
      // 验证 ID 格式
      if (!ObjectId.isValid(params.id)) {
        set.status = 400;
        return error(400, "Invalid note ID format");
      }

      const note = await db_findById(DB_NAME, COLLECTION, params.id);

      if (!note) {
        set.status = 404;
        return error(404, "Note not found");
      }

      return success(note);
    } catch (err) {
      console.error("Error fetching note by ID:", err);
      set.status = 500;
      return error(500, "Failed to fetch note");
    }
  });
