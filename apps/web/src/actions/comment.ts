"use server";

import type { CreateCommentRequest, UpdateCommentRequest } from "@/types/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createComment as apiCreateComment, deleteComment as apiDeleteComment, updateComment as apiUpdateComment } from "@/lib/api-client";

const COMMENT_FORWARD_HEADER_NAMES = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "user-agent",
] as const;

/**
 * 评论通过 Server Action 转发到后端时，需要保留真实访问来源。
 *
 * 后端仍会以可信代理头优先、socket 地址兜底；这里仅把 Next 收到的来源信息
 * 原样传给后端，避免匿名评论只记录到 BFF 服务地址。
 */
async function buildCommentForwardHeaders() {
  const incomingHeaders = await headers();
  const forwardedHeaders: Record<string, string> = {};

  for (const headerName of COMMENT_FORWARD_HEADER_NAMES) {
    const value = incomingHeaders.get(headerName);
    if (value) {
      forwardedHeaders[headerName] = value;
    }
  }

  return forwardedHeaders;
}

/**
 * Server Action: 创建评论
 */
export async function createCommentAction(request: CreateCommentRequest) {
  try {
    const result = await apiCreateComment(request, await buildCommentForwardHeaders());

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
        message: result.message || "",
      };
    }

    return {
      code: result.code || 400,
      status: "failed" as const,
      message: result.message || "",
    };
  } catch (error) {
    console.error("Failed to create comment:", error);
    return {
      code: 500,
      status: "failed" as const,
      message: "",
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
        message: result.message || "",
      };
    }

    return {
      success: false,
      message: result.message || "",
    };
  } catch (error) {
    console.error("Failed to update comment:", error);
    return {
      success: false,
      message: "",
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
        message: result.message || "",
      };
    }

    return {
      success: false,
      message: result.message || "",
    };
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return {
      success: false,
      message: "",
    };
  }
}
