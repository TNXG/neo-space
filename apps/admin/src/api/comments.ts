import type { PaginateResult } from "~/models/base";
import type { CommentModel } from "~/models/comment";
import md5 from "md5";

import { CommentState } from "~/models/comment";
import { request } from "~/utils/request";

export interface GetCommentsParams {
  page?: number;
  size?: number;
  state?: number;
}

export interface ReplyCommentData {
  text: string;
  ref: string;
  refType: CommentModel["refType"];
}

interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T | null;
}

interface BackendPaginatedComments {
  items: BackendComment[];
  pagination: BackendPagination;
}

type BackendPagination = Partial<PaginateResult<CommentModel>["pagination"]> & {
  current_page?: number;
  total_page?: number;
  has_next_page?: boolean;
  has_prev_page?: boolean;
};

type BackendComment = Partial<Omit<CommentModel, "state" | "refType">> & {
  _id?: string;
  created?: string;
  createdAt?: string;
  ref?: string;
  refId?: string;
  refType?: string;
  ref_type?: string;
  state?: number | string;
  status?: string;
  mail?: string;
  email?: string;
  agent?: string;
  userAgent?: string;
  ua?: BackendUserAgent | BackendUserAgent[] | string | null;
  localtion?: string;
  parent?: string | CommentModel["parent"] | null;
  parentCommentId?: string | null;
  parentId?: string | null;
};

interface BackendUserAgent {
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
  rawUserAgent?: string;
  brand?: string;
  version?: string;
}

function unwrapApiResponse<T>(response: T | ApiResponse<T>): T {
  if (
    response
    && typeof response === "object"
    && "data" in response
    && "status" in response
  ) {
    const payload = (response as ApiResponse<T>).data;
    if (payload === null) {
      throw new Error((response as ApiResponse<T>).message || "评论数据为空");
    }
    return payload;
  }

  return response as T;
}

function normalizeCommentState(comment: BackendComment): CommentState {
  if (typeof comment.state === "number") {
    return comment.state;
  }

  const status = String(comment.status ?? comment.state ?? "").toLowerCase();
  switch (status) {
    case "approved":
    case "read":
      return CommentState.Read;
    case "pending":
      return CommentState.Pending;
    case "spam":
    case "rejected":
      return CommentState.Junk;
    default:
      return CommentState.Unread;
  }
}

function normalizeCommentRefType(refType?: string): CommentModel["refType"] {
  switch (refType) {
    case "posts":
    case "post":
      return "post";
    case "notes":
    case "note":
      return "note";
    case "pages":
    case "page":
      return "page";
    case "recently":
      return "recently";
    default:
      return "post";
  }
}

function normalizeParentPreview(parent: BackendComment["parent"]) {
  if (!parent || typeof parent === "string") {
    return null;
  }

  return parent;
}

function stringifyUserAgentItem(userAgent: BackendUserAgent | string) {
  if (typeof userAgent === "string") {
    return userAgent;
  }

  if (userAgent.rawUserAgent) {
    return userAgent.rawUserAgent;
  }

  if (userAgent.brand || userAgent.version) {
    return [userAgent.brand, userAgent.version].filter(Boolean).join("/");
  }

  return [
    userAgent.browser,
    userAgent.browserVersion,
    userAgent.os,
    userAgent.osVersion,
    userAgent.device,
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeUserAgent(ua: BackendComment["ua"]) {
  if (!ua) {
    return undefined;
  }

  if (Array.isArray(ua)) {
    return ua
      .map(stringifyUserAgentItem)
      .filter(Boolean)
      .join(" / ");
  }

  return stringifyUserAgentItem(ua);
}

function normalizeAgent(comment: BackendComment) {
  return (
    comment.agent
    ?? comment.userAgent
    ?? normalizeUserAgent(comment.ua)
    ?? undefined
  );
}

function generateAvatarFallback(comment: BackendComment) {
  const email = (comment.mail ?? comment.email)?.trim().toLowerCase();
  if (email) {
    return `https://cravatar.cn/avatar/${md5(email)}?d=mp`;
  }

  const name = comment.author || "Guest";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}

function normalizeComment(comment: BackendComment): CommentModel {
  const commentId = comment._id ?? "";
  const ref = comment.ref ?? comment.refId ?? "";

  return {
    ...comment,
    _id: commentId,
    createdAt: comment.createdAt ?? comment.created ?? "",
    ref,
    refType: normalizeCommentRefType(comment.refType ?? comment.ref_type),
    state: normalizeCommentState(comment),
    author: comment.author ?? "",
    text: comment.text ?? "",
    mail: comment.mail ?? comment.email,
    avatar: comment.avatar || generateAvatarFallback(comment),
    agent: normalizeAgent(comment),
    parentCommentId:
      comment.parentCommentId
      ?? (typeof comment.parent === "string" ? comment.parent : null)
      ?? comment.parentId
      ?? null,
    parent: normalizeParentPreview(comment.parent),
    rootCommentId: comment.rootCommentId ?? null,
    replyCount: comment.replyCount ?? 0,
    latestReplyAt: comment.latestReplyAt ?? null,
    isDeleted: comment.isDeleted ?? false,
  };
}

function normalizePagination(pagination?: BackendPagination) {
  const total = pagination?.total ?? 0;
  const size = pagination?.size ?? 20;
  const currentPage = pagination?.currentPage ?? pagination?.current_page ?? 1;
  const totalPage
    = pagination?.totalPage ?? pagination?.total_page ?? Math.ceil(total / size);

  return {
    total,
    size,
    currentPage,
    totalPage,
    hasPrevPage:
      pagination?.hasPrevPage
      ?? pagination?.has_prev_page
      ?? currentPage > 1,
    hasNextPage:
      pagination?.hasNextPage
      ?? pagination?.has_next_page
      ?? currentPage < totalPage,
  };
}

function normalizeCommentListResponse(
  response:
    | PaginateResult<CommentModel>
    | ApiResponse<BackendPaginatedComments>,
): PaginateResult<CommentModel> {
  const payload = unwrapApiResponse(response as ApiResponse<BackendPaginatedComments>);
  const items = payload.items ?? (payload as { data?: CommentModel[] }).data;

  return {
    data: (items ?? []).map(comment => normalizeComment(comment as BackendComment)),
    pagination: normalizePagination(payload.pagination),
  };
}

export const commentsApi = {
  // 获取评论列表
  getList: async (params?: GetCommentsParams) => {
    const response = await request.get<ApiResponse<BackendPaginatedComments>>(
      "/comments",
      {
        bypassTransform: true,
        params,
      },
    );
    return normalizeCommentListResponse(response);
  },

  // 获取单个评论
  getById: (id: string) => request.get<CommentModel>(`/comments/${id}`),

  // 回复评论（普通）
  reply: (id: string, data: ReplyCommentData) =>
    request.post<CommentModel>("/comments", { data: { ...data, parent: id } }),

  // 登录态回复评论（只需 text）
  readerReply: (comment: CommentModel, text: string) =>
    commentsApi.reply(comment._id, {
      text,
      ref: comment.ref,
      refType: comment.refType,
    }),

  // 更新评论状态
  updateState: (id: string, state: number) =>
    request.patch<CommentModel>(`/comments/${id}/state`, { data: { state } }),

  // 批量更新状态
  batchUpdateState: (
    options:
      | { ids: string[]; state: number }
      | { all: true; state: number; currentState: number },
  ) => request.patch<void>("/comments/state", { data: options }),

  // 删除评论
  delete: (id: string) => request.delete<void>(`/comments/${id}`),

  // 批量删除
  batchDelete: (options: { ids: string[] } | { all: true; state: number }) =>
    request.delete<void>("/comments/batch", { data: options }),
};
