"use server";

import type { CreateCommentRequest, UpdateCommentRequest } from "@/types/api";
import { revalidatePath } from "next/cache";
import { createComment as apiCreateComment, deleteComment as apiDeleteComment, updateComment as apiUpdateComment } from "@/lib/api-client";

/**
 * Server Action: 创建评论
 */
export async function createCommentAction(request: CreateCommentRequest) {
	try {
		const result = await apiCreateComment(request);

		if (result.status === "success") {
			// 根据 refType 刷新对应页面
			if (request.refType === "posts") {
				revalidatePath("/posts/[category]/[slug]", "page");
			} else if (request.refType === "notes") {
				revalidatePath("/notes/[nid]", "page");
			} else if (request.refType === "pages") {
				revalidatePath("/pages/[slug]", "page");
			}

			return {
				code: 201,
				status: "success" as const,
				data: result.data,
				message: result.message || "评论发布成功",
			};
		}

		return {
			code: result.code || 400,
			status: "failed" as const,
			message: result.message || "评论发布失败",
		};
	} catch (error) {
		console.error("Failed to create comment:", error);
		return {
			code: 500,
			status: "failed" as const,
			message: "评论发布失败，请稍后重试",
		};
	}
}

/**
 * Server Action: 更新评论
 */
export async function updateCommentAction(id: string, request: UpdateCommentRequest) {
	try {
		const result = await apiUpdateComment(id, request);

		if (result.status === "success") {
			return {
				success: true,
				data: result.data,
				message: "评论更新成功",
			};
		}

		return {
			success: false,
			message: result.message || "评论更新失败",
		};
	} catch (error) {
		console.error("Failed to update comment:", error);
		return {
			success: false,
			message: "评论更新失败，请稍后重试",
		};
	}
}

/**
 * Server Action: 删除评论
 */
export async function deleteCommentAction(id: string, refType: string) {
	try {
		const result = await apiDeleteComment(id);

		if (result.status === "success") {
			// 根据 refType 刷新对应页面
			if (refType === "posts") {
				revalidatePath("/posts/[category]/[slug]", "page");
			} else if (refType === "notes") {
				revalidatePath("/notes/[nid]", "page");
			} else if (refType === "pages") {
				revalidatePath("/pages/[slug]", "page");
			}

			return {
				success: true,
				message: "评论删除成功",
			};
		}

		return {
			success: false,
			message: result.message || "评论删除失败",
		};
	} catch (error) {
		console.error("Failed to delete comment:", error);
		return {
			success: false,
			message: "评论删除失败，请稍后重试",
		};
	}
}
