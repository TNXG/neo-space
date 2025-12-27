/**
 * Revalidate API Route - 接收后端通知并重新验证 ISR 缓存
 *
 * 安全机制:
 * 1. HMAC-SHA256 签名验证
 * 2. 时间戳验证（±5分钟窗口，防止重放攻击）
 * 3. 严格的请求体校验
 */

/* eslint-disable node/prefer-global/process */
/* eslint-disable node/prefer-global/buffer */

import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

// 从环境变量读取配置
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;
const REVALIDATION_SALT = process.env.REVALIDATION_SALT || "default-salt";
const TIME_WINDOW_SECONDS = 300; // ±5分钟

/**
 * 验证 HMAC 签名
 */
function verifySignature(
	tag: string | undefined,
	path: string | undefined,
	timestamp: number,
	signature: string,
): boolean {
	if (!REVALIDATION_SECRET) {
		console.error("REVALIDATION_SECRET 未配置");
		return false;
	}

	// 构造消息: secret + timestamp + salt + (tag or path)
	const target = tag || path || "";
	const message = `${REVALIDATION_SECRET}${timestamp}${REVALIDATION_SALT}${target}`;

	// 生成 HMAC-SHA256 签名
	const hmac = createHmac("sha256", REVALIDATION_SECRET);
	hmac.update(message);
	const expectedSignature = hmac.digest("hex");

	// 使用时间安全的比较
	return timingSafeEqual(expectedSignature, signature);
}

/**
 * 时间安全的字符串比较（防止时序攻击）
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	// 使用 Node.js 内置的 timingSafeEqual
	const bufA = Buffer.from(a, "utf8");
	const bufB = Buffer.from(b, "utf8");

	try {
		return cryptoTimingSafeEqual(bufA, bufB);
	} catch {
		return false;
	}
}

/**
 * 验证时间戳（防止重放攻击）
 */
function verifyTimestamp(timestamp: number): boolean {
	const now = Math.floor(Date.now() / 1000);
	const diff = Math.abs(now - timestamp);

	if (diff > TIME_WINDOW_SECONDS) {
		console.warn(
			`时间戳验证失败 - 当前: ${now}, 请求: ${timestamp}, 差值: ${diff}秒`,
		);
		return false;
	}

	return true;
}

/**
 * POST /api/revalidate
 *
 * 请求体:
 * {
 *   "tag": "posts",           // 或 "path": "/posts/my-post"
 *   "timestamp": 1234567890,  // Unix 时间戳（秒）
 *   "signature": "abc123..."  // HMAC-SHA256 签名
 * }
 */
export async function POST(request: NextRequest) {
	try {
		// 1. 解析请求体
		const body = await request.json();
		const { tag, path, timestamp, signature } = body;

		// 2. 基础验证
		if (!timestamp || !signature) {
			return NextResponse.json(
				{ success: false, message: "缺少必需参数: timestamp 或 signature" },
				{ status: 400 },
			);
		}

		if (!tag && !path) {
			return NextResponse.json(
				{ success: false, message: "必须提供 tag 或 path 参数" },
				{ status: 400 },
			);
		}

		// 3. 验证时间戳（防止重放攻击）
		if (!verifyTimestamp(timestamp)) {
			return NextResponse.json(
				{ success: false, message: "时间戳验证失败（可能是重放攻击）" },
				{ status: 401 },
			);
		}

		// 4. 验证 HMAC 签名
		if (!verifySignature(tag, path, timestamp, signature)) {
			console.error("HMAC 签名验证失败");
			return NextResponse.json(
				{ success: false, message: "签名验证失败" },
				{ status: 401 },
			);
		}

		// 5. 执行重新验证
		const startTime = Date.now();
		if (tag) {
			revalidateTag(tag, "default");
			console.warn(`[Revalidate] ✓ Tag "${tag}" 已刷新 (${Date.now() - startTime}ms)`);
		} else if (path) {
			revalidatePath(path, "page");
			console.warn(`[Revalidate] ✓ Path "${path}" 已刷新 (${Date.now() - startTime}ms)`);
		}

		return NextResponse.json({
			success: true,
			message: tag
				? `标签 "${tag}" 已重新验证`
				: `路径 "${path}" 已重新验证`,
			revalidated: true,
			timestamp: Math.floor(Date.now() / 1000),
		});
	} catch (error) {
		console.error("[Revalidate] 错误:", error);
		return NextResponse.json(
			{
				success: false,
				message: "内部服务器错误",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

/**
 * GET /api/revalidate - 健康检查
 */
export async function GET() {
	return NextResponse.json({
		service: "Revalidation API",
		status: "healthy",
		configured: !!REVALIDATION_SECRET,
		timeWindow: `±${TIME_WINDOW_SECONDS}秒`,
	});
}
