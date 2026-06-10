import type { PaginateResult } from "~/models/base";
import type { CommentModel } from "~/models/comment";

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
  data: T;
}

interface BackendPaginatedComments {
  items: CommentModel[];
  pagination: PaginateResult<CommentModel>["pagination"];
}

function unwrapApiResponse<T>(response: T | ApiResponse<T>): T {
  if (
    response
    && typeof response === "object"
    && "data" in response
    && "status" in response
  ) {
    return (response as ApiResponse<T>).data;
  }

  return response as T;
}

function normalizeCommentListResponse(
  response:
    | PaginateResult<CommentModel>
    | ApiResponse<BackendPaginatedComments>,
): PaginateResult<CommentModel> {
  const payload = unwrapApiResponse(response as ApiResponse<BackendPaginatedComments>);
  const items = payload.items ?? (payload as { data?: CommentModel[] }).data;

  return {
    data: items ?? [],
    pagination: payload.pagination,
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
