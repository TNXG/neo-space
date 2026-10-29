import type { Category, DashboardDraft, DashboardDraftInput, DashboardPageInput, DashboardPostInput, DashboardUploadResult, Page, PaginatedData, Post, TagSummary } from "@/types/api";
import { dashboardRequest } from "./dashboard-api";

export const DASHBOARD_CATEGORIES_KEY = "dashboard-categories";
export const DASHBOARD_TAGS_KEY = "dashboard-tags";
export const DASHBOARD_PAGES_KEY = "dashboard-pages";

export interface DashboardPostQuery {
  page: number;
  keyword?: string;
  categoryId?: string;
}

/** 文章列表缓存键：包含影响响应的全部参数。 */
export const dashboardPostsKey = (query: DashboardPostQuery) => ["dashboard-posts", query.page, query.keyword ?? "", query.categoryId ?? ""] as const;
export const dashboardPostKey = (_id: string) => ["dashboard-post", _id] as const;
export const dashboardPageKey = (_id: string) => ["dashboard-page", _id] as const;

/**
 * Owner Cookie 下列表包含未发布文章；按修改时间倒序，最近编辑的排在最前。
 * @param query 分页与筛选
 * @returns 分页文章
 */
export function getDashboardPosts(query: DashboardPostQuery): Promise<PaginatedData<Post>> {
  const params = new URLSearchParams({ page: String(query.page), size: "20", sortBy: "modified", sortOrder: "-1" });
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.categoryId) params.set("categoryIds", query.categoryId);
  return dashboardRequest<PaginatedData<Post>>(`/posts?${params}`);
}

/** 读取原文（不带 lang 参数，避免把翻译稿当原文编辑）。 */
export function getDashboardPost(_id: string): Promise<Post> {
  return dashboardRequest<Post>(`/posts/${encodeURIComponent(_id)}`);
}

export function createDashboardPost(input: DashboardPostInput): Promise<Post> {
  return dashboardRequest<Post>("/posts", { method: "POST", body: JSON.stringify(input) });
}

export function updateDashboardPost(_id: string, input: Partial<DashboardPostInput>): Promise<Post> {
  return dashboardRequest<Post>(`/posts/${encodeURIComponent(_id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteDashboardPost(_id: string): Promise<unknown> {
  return dashboardRequest<unknown>(`/posts/${encodeURIComponent(_id)}`, { method: "DELETE" });
}

export function getDashboardCategories(): Promise<Category[]> {
  return dashboardRequest<Category[]>("/categories");
}

export function getDashboardTags(): Promise<TagSummary[]> {
  return dashboardRequest<TagSummary[]>("/categories?type=tag");
}

export function getDashboardPages(): Promise<Page[]> {
  return dashboardRequest<Page[]>("/pages/list");
}

export function getDashboardPage(_id: string): Promise<Page> {
  return dashboardRequest<Page>(`/pages/id/${encodeURIComponent(_id)}`);
}

export function createDashboardPage(input: DashboardPageInput): Promise<Page> {
  return dashboardRequest<Page>("/pages", { method: "POST", body: JSON.stringify(input) });
}

export function updateDashboardPage(_id: string, input: Partial<DashboardPageInput>): Promise<Page> {
  return dashboardRequest<Page>(`/pages/id/${encodeURIComponent(_id)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteDashboardPage(_id: string): Promise<unknown> {
  return dashboardRequest<unknown>(`/pages/id/${encodeURIComponent(_id)}`, { method: "DELETE" });
}

/**
 * 上传编辑器内联图片，返回公开地址。
 * @param file 图片文件
 * @returns 上传结果
 */
export function uploadDashboardImage(file: File): Promise<DashboardUploadResult> {
  const body = new FormData();
  body.append("type", "image");
  body.append("file", file);
  return dashboardRequest<DashboardUploadResult>("/files/upload", { method: "POST", body, timeout: 60000 });
}

/* ---------- 服务端草稿 ---------- */

export const dashboardDraftKey = (kind: "post" | "page", refId: string | undefined, draftId: string | undefined) => ["dashboard-draft", kind, refId ?? "new", draftId ?? ""] as const;
export const dashboardNewDraftsKey = (kind: "post" | "page") => ["dashboard-new-drafts", kind] as const;

/** 已有内容的草稿；没有时返回 null。 */
export function getDashboardDraftByRef(kind: "post" | "page", refId: string): Promise<DashboardDraft | null> {
  return dashboardRequest<DashboardDraft | null>(`/drafts/by-ref/${kind}/${encodeURIComponent(refId)}`);
}

export function getDashboardDraft(_id: string): Promise<DashboardDraft> {
  return dashboardRequest<DashboardDraft>(`/drafts/${encodeURIComponent(_id)}`);
}

/** 尚未创建正式内容的新草稿，按更新时间倒序。 */
export function getDashboardNewDrafts(kind: "post" | "page"): Promise<DashboardDraft[]> {
  return dashboardRequest<DashboardDraft[]>(`/drafts/by-ref/${kind}/new`);
}

export function createDashboardDraft(input: DashboardDraftInput): Promise<DashboardDraft> {
  return dashboardRequest<DashboardDraft>("/drafts", { method: "POST", body: JSON.stringify(input) });
}

export function updateDashboardDraft(_id: string, input: Partial<DashboardDraftInput>): Promise<DashboardDraft> {
  return dashboardRequest<DashboardDraft>(`/drafts/${encodeURIComponent(_id)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteDashboardDraft(_id: string): Promise<unknown> {
  return dashboardRequest<unknown>(`/drafts/${encodeURIComponent(_id)}`, { method: "DELETE" });
}
