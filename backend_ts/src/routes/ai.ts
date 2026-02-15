import type { TimeCapsuleAnalyzeRequest } from "@/types/api";
import type { TimeCapsule, TimeCapsuleResponse, TimeSensitivity } from "@/types/models";
import { Elysia, t } from "elysia";
import { ObjectId } from "mongodb";
import { getConfig } from "@/config";
import { db_find, db_insert, db_read } from "@/lib/db";
import { responsePlugin } from "@/plugins/response";

const config = getConfig();
const DB_NAME = config.mongodb.database || "mx-space";
const TIME_CAPSULES_COLLECTION = "time_capsules";

/**
 * 计算内容的 SHA1 哈希值
 */
async function computeSha1(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 获取缓存的时间胶囊分析结果
 */
async function getCachedCapsule(
  refId: string,
  contentHash: string,
): Promise<TimeCapsule | null> {
  try {
    // 查询最新的分析结果
    const results = await db_read(
      DB_NAME,
      TIME_CAPSULES_COLLECTION,
      { refId },
      { sort: { created: -1 }, limit: 1 },
    );

    if (results.length === 0) {
      console.log(`[AI] No cached capsule found for refId: ${refId}`);
      return null;
    }

    const existing = results[0] as TimeCapsule;
    console.log(
      `[AI] Found cached capsule - db_hash: ${existing.hash}, current_hash: ${contentHash}`,
    );

    // 检查内容哈希是否匹配
    if (existing.hash === contentHash) {
      console.log("[AI] Hash matched, returning cached result");
      return existing;
    }

    console.log("[AI] Hash mismatch, need new analysis");
    return null;
  } catch (err) {
    console.error("[AI] Error fetching cached capsule:", err);
    return null;
  }
}

/**
 * 保存时间胶囊分析结果到数据库
 */
async function saveTimeCapsule(
  refId: string,
  refType: string,
  contentHash: string,
  sensitivity: TimeSensitivity,
  reason: string,
  markers: string[],
): Promise<boolean> {
  try {
    const capsule = {
      refId,
      refType,
      sensitivity,
      reason,
      markers,
      hash: contentHash,
      created: new Date(),
    };

    const success = await db_insert(DB_NAME, TIME_CAPSULES_COLLECTION, capsule);
    if (success) {
      console.log(`[AI] Saved time capsule for refId: ${refId}`);
    } else {
      console.error(`[AI] Failed to save time capsule for refId: ${refId}`);
    }
    return success;
  } catch (err) {
    console.error("[AI] Error saving time capsule:", err);
    return false;
  }
}

/**
 * 模拟 AI 分析（因为实际 AI 服务未实现）
 * 在实际环境中，这里应该调用真实的 AI 服务
 */
function mockAiAnalysis(
  title: string,
  content: string,
): { sensitivity: TimeSensitivity; reason: string; markers: string[] } {
  // 简单的关键词检测逻辑
  const text = `${title} ${content}`.toLowerCase();
  const markers: string[] = [];

  // 检测技术版本号
  const versionPatterns = [
    /react\s+\d+/gi,
    /node\.?js\s+\d+/gi,
    /vue\s+\d+/gi,
    /angular\s+\d+/gi,
    /python\s+\d+/gi,
  ];

  for (const pattern of versionPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      markers.push(...matches);
    }
  }

  // 检测 API 相关
  if (text.includes("api") && (text.includes("endpoint") || text.includes("接口"))) {
    markers.push("API 接口");
  }

  // 检测配置相关
  if (text.includes("config") || text.includes("配置")) {
    markers.push("配置方式");
  }

  // 根据检测结果判断时效性
  let sensitivity: TimeSensitivity;
  let reason: string;

  if (markers.length >= 3) {
    sensitivity = "high";
    reason = "内容包含多个技术版本、API 或配置相关信息，属于高时效性内容";
  } else if (markers.length >= 1) {
    sensitivity = "medium";
    reason = "内容包含部分技术细节，可能随时间变化";
  } else {
    sensitivity = "low";
    reason = "内容主要为概念性或原理性知识，不易过期";
  }

  return { sensitivity, reason, markers };
}

/**
 * AI 路由处理器
 *
 * 提供以下端点：
 * - POST /ai/time-capsule/analyze - 分析时间胶囊
 * - GET /ai/time-capsule/:refId - 获取分析结果
 */
export const aiRoutes = new Elysia({ prefix: "/ai" })
  .use(responsePlugin())

  // POST /ai/time-capsule/analyze - 分析时间胶囊
  .post(
    "/time-capsule/analyze",
    async ({ body, success, error, set }) => {
      try {
        const { refId, refType, content } = body;

        // 1. 输入验证
        if (!refId || !refType || !content) {
          set.status = 400;
          return error(400, "Missing required fields: refId, refType, content");
        }

        if (!["post", "note"].includes(refType)) {
          set.status = 400;
          return error(400, "Invalid refType, must be 'post' or 'note'");
        }

        // 验证 refId 是否为有效的 ObjectId
        if (!ObjectId.isValid(refId)) {
          set.status = 400;
          return error(400, "Invalid refId format");
        }

        // 2. 获取内容并计算哈希
        const contentHash = await computeSha1(content);
        console.log(`[AI] Analyzing refId: ${refId}, hash: ${contentHash}`);

        // 3. 检查缓存
        const cached = await getCachedCapsule(refId, contentHash);
        if (cached) {
          const response: TimeCapsuleResponse = {
            sensitivity: cached.sensitivity,
            reason: cached.reason,
            markers: cached.markers,
            isNew: false,
          };
          return success(response);
        }

        // 4. 调用 AI 分析（这里使用模拟实现）
        // 注意：在实际环境中，这里应该调用真实的 AI 服务
        // 如果 AI 服务不可用，应该返回 503 错误
        console.log("[AI] No cache found, performing analysis");

        // 从 content 中提取标题（假设格式为 "标题\n\n内容"）
        const lines = content.split("\n");
        const title = lines[0] || "Untitled";
        const text = lines.slice(1).join("\n");

        const analysis = mockAiAnalysis(title, text);

        // 5. 保存分析结果
        const saved = await saveTimeCapsule(
          refId,
          refType,
          contentHash,
          analysis.sensitivity,
          analysis.reason,
          analysis.markers,
        );

        if (!saved) {
          console.error("[AI] Failed to save analysis result");
          // 即使保存失败，也返回分析结果
        }

        const response: TimeCapsuleResponse = {
          sensitivity: analysis.sensitivity,
          reason: analysis.reason,
          markers: analysis.markers,
          isNew: true,
        };

        return success(response);
      } catch (err) {
        console.error("[AI] Error analyzing time capsule:", err);
        set.status = 500;
        return error(500, "Failed to analyze time capsule");
      }
    },
    {
      body: t.Object({
        refId: t.String(),
        refType: t.Union([t.Literal("post"), t.Literal("note")]),
        content: t.String(),
      }),
    },
  )

  // GET /ai/time-capsule/:refId - 获取分析结果
  .get("/time-capsule/:refId", async ({ params, success, error, set }) => {
    try {
      const { refId } = params;

      // 验证 refId 格式
      if (!ObjectId.isValid(refId)) {
        set.status = 400;
        return error(400, "Invalid refId format");
      }

      // 查询最新的分析结果
      const results = await db_read(
        DB_NAME,
        TIME_CAPSULES_COLLECTION,
        { refId },
        { sort: { created: -1 }, limit: 1 },
      );

      if (results.length === 0) {
        set.status = 404;
        return error(404, "Time capsule analysis not found");
      }

      const capsule = results[0] as TimeCapsule;
      const response: TimeCapsuleResponse = {
        sensitivity: capsule.sensitivity,
        reason: capsule.reason,
        markers: capsule.markers,
        isNew: false,
      };

      return success(response);
    } catch (err) {
      console.error("[AI] Error fetching time capsule:", err);
      set.status = 500;
      return error(500, "Failed to fetch time capsule");
    }
  });
