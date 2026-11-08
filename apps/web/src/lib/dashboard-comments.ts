import type { ApiResponse, Comment, CommentListResponse, PaginatedData } from "@/types/api";
import type { DashboardComment, DashboardCommentReply, DashboardCommentState } from "@/types/dashboard-comments";
import { dashboardRequest, dashboardResponse } from "./dashboard-api";

/** Distinguish all owner comment caches, including counts and conversation context. */
export const isDashboardCommentsKey = (key: unknown) => Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith("dashboard-comments-");
export const dashboardCommentsKey = (state: DashboardCommentState, page: number, size = 20) => ["dashboard-comments-list", state, page, size] as const;
export const dashboardCommentCountKey = (state: DashboardCommentState) => ["dashboard-comments-count", state] as const;
export const dashboardCommentThreadKey = (ref: string, refType: string) => ["dashboard-comments-thread", ref, refType] as const;

/** The API has no text search or standalone count endpoint; pagination.total is authoritative. */
export function getDashboardComments(state: DashboardCommentState, page: number, size = 20): Promise<ApiResponse<PaginatedData<DashboardComment>>> {
  return dashboardResponse<PaginatedData<DashboardComment>>(`/comments?state=${state}&page=${page}&size=${size}`);
}

/** Owner-authenticated document thread provides live replies for a selected comment. */
export function getDashboardCommentThread(ref: string, refType: string): Promise<ApiResponse<CommentListResponse>> {
  return dashboardResponse<CommentListResponse>(`/comments?${new URLSearchParams({ ref, ref_type: refType })}`);
}

/** Changes only explicitly selected _id values, never an unseen whole filter. */
export function setDashboardCommentStates(ids: string[], state: DashboardCommentState): Promise<number> {
  return dashboardRequest<number>("/comments/state", { method: "PATCH", body: JSON.stringify({ ids, state }) });
}

/** Bulk deletion soft-deletes exactly the selected comments, unlike single subtree deletion. */
export function deleteDashboardComments(ids: string[]): Promise<number> {
  return dashboardRequest<number>("/comments/batch", { method: "DELETE", body: JSON.stringify({ ids }) });
}

/** Single deletion also soft-deletes descendants, matching the endpoint's explicit contract. */
export function deleteDashboardComment(_id: string): Promise<unknown> {
  return dashboardRequest<unknown>(`/comments/${encodeURIComponent(_id)}`, { method: "DELETE" });
}

/** Update comment text using owner Cookie authorization. */
export function editDashboardComment(_id: string, text: string): Promise<Comment> {
  return dashboardRequest<Comment>(`/comments/${encodeURIComponent(_id)}`, { method: "PUT", body: JSON.stringify({ text }) });
}

/** Reply identity comes from the owner session and follows normal backend comment policies. */
export function replyDashboardComment(input: DashboardCommentReply): Promise<Comment> {
  return dashboardRequest<Comment>("/comments", { method: "POST", body: JSON.stringify(input) });
}

/** Toggle existing owner-only pin or private-comment capabilities. */
export function toggleDashboardComment(_id: string, kind: "pin" | "hide", enabled: boolean): Promise<unknown> {
  return dashboardRequest<unknown>(`/comments/${encodeURIComponent(_id)}/${kind}`, { method: enabled ? "PATCH" : "DELETE" });
}
