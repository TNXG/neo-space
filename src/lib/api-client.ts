import type { ApiResponse, Category, Comment, CommentListResponse, CreateCommentRequest, Link, Note, Page, PaginatedResponse, Post, Reader, Recently, SiteConfig, TimeCapsuleRequest, TimeCapsuleResponse, UpdateCommentRequest, User } from "@/types/api";
import process from "node:process";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Generic API client with error handling and ISR support
 */
async function apiClient<T>(
	endpoint: string,
	options?: RequestInit & {
		tags?: string[];
		revalidate?: number | false;
	},
): Promise<T> {
	const { tags, revalidate, ...fetchOptions } = options || {};

	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		headers: {
			"Content-Type": "application/json",
		},
		...fetchOptions,
		next: {
			tags,
			revalidate,
		},
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Posts API
 */
export async function getPosts(page = 1, size = 10): Promise<PaginatedResponse<Post>> {
	return apiClient<PaginatedResponse<Post>>(`/posts?page=${page}&size=${size}`, {
		tags: ["posts"],
		revalidate: false, // 永不过期，依赖 Change Stream 主动刷新
	});
}

export async function getPostById(id: string): Promise<ApiResponse<Post>> {
	return apiClient<ApiResponse<Post>>(`/posts/${id}`, {
		tags: ["posts", `post-${id}`],
		revalidate: false,
	});
}

export async function getPostBySlug(slug: string): Promise<ApiResponse<Post>> {
	return apiClient<ApiResponse<Post>>(`/posts/slug/${slug}`, {
		tags: ["posts", `post-slug-${slug}`],
		revalidate: false,
	});
}

/**
 * Pages API
 */
export async function getPageBySlug(slug: string): Promise<ApiResponse<Page>> {
	return apiClient<ApiResponse<Page>>(`/pages/${slug}`, {
		tags: ["pages", `page-${slug}`],
		revalidate: false,
	});
}

/**
 * Notes API
 */
export async function getNotes(page = 1, size = 10): Promise<PaginatedResponse<Note>> {
	return apiClient<PaginatedResponse<Note>>(`/notes?page=${page}&size=${size}`, {
		tags: ["notes"],
		revalidate: false,
	});
}

export async function getNoteById(id: string): Promise<ApiResponse<Note>> {
	return apiClient<ApiResponse<Note>>(`/notes/${id}`, {
		tags: ["notes", `note-${id}`],
		revalidate: false,
	});
}

export async function getNoteByNid(nid: number): Promise<ApiResponse<Note>> {
	return apiClient<ApiResponse<Note>>(`/notes/nid/${nid}`, {
		tags: ["notes", `note-nid-${nid}`],
		revalidate: false,
	});
}

/**
 * Adjacent Notes API
 */
export interface AdjacentNote {
	nid: number;
	title: string;
}

export interface AdjacentNotes {
	prev: AdjacentNote | null;
	next: AdjacentNote | null;
}

export async function getAdjacentNotes(nid: number): Promise<ApiResponse<AdjacentNotes>> {
	return apiClient<ApiResponse<AdjacentNotes>>(`/notes/nid/${nid}/adjacent`, {
		tags: ["notes"],
		revalidate: false,
	});
}

/**
 * Adjacent Posts API
 */
export interface AdjacentPost {
	slug: string;
	title: string;
	categorySlug: string;
}

export interface AdjacentPosts {
	prev: AdjacentPost | null;
	next: AdjacentPost | null;
}

export async function getAdjacentPosts(slug: string): Promise<ApiResponse<AdjacentPosts>> {
	return apiClient<ApiResponse<AdjacentPosts>>(`/posts/slug/${slug}/adjacent`, {
		tags: ["posts"],
		revalidate: false,
	});
}

/**
 * Categories API
 */
export async function getCategories(): Promise<ApiResponse<Category[]>> {
	return apiClient<ApiResponse<Category[]>>("/categories", {
		tags: ["categories"],
		revalidate: false,
	});
}

/**
 * Links API
 */
export async function getLinks(page = 1, size = 10): Promise<PaginatedResponse<Link>> {
	return apiClient<PaginatedResponse<Link>>(`/links?page=${page}&size=${size}`);
}

/**
 * Recently API
 */
export async function getRecently(limit = 10): Promise<PaginatedResponse<Recently>> {
	return apiClient<PaginatedResponse<Recently>>(`/recentlies?page=1&size=${limit}`);
}

/**
 * Users API
 */
export async function getUserProfile(): Promise<ApiResponse<User>> {
	return apiClient<ApiResponse<User>>("/user/profile", {
		cache: "force-cache", // 永久缓存用户资料
		next: {
			tags: ["user-profile"],
			revalidate: false, // 不自动重新验证
		},
	});
}

export async function getReaders(): Promise<ApiResponse<Reader[]>> {
	return apiClient<ApiResponse<Reader[]>>("/readers");
}

export async function getReaderById(id: string): Promise<ApiResponse<Reader>> {
	return apiClient<ApiResponse<Reader>>(`/readers/${id}`);
}

/**
 * Nbnhhsh API - 能不能好好说话缩写翻译
 */
export interface NbnhhshResult {
	name: string;
	trans?: string[] | null;
	inputting?: string[];
}

export async function guessAbbreviation(text: string): Promise<NbnhhshResult[]> {
	const response = await fetch(`${API_BASE_URL}/nbnhhsh/guess`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text }),
	});

	if (!response.ok) {
		return [];
	}

	return response.json();
}

/**
 * Site Config API
 */
export async function getSiteConfig(): Promise<ApiResponse<SiteConfig>> {
	return apiClient<ApiResponse<SiteConfig>>("/config", {
		cache: "force-cache",
		next: {
			tags: ["site-config"],
			revalidate: 3600, // 1小时重新验证
		},
	});
}

/**
 * Time Capsule API - 文章时效性分析
 */
export async function analyzeTimeCapsule(
	request: TimeCapsuleRequest,
): Promise<ApiResponse<TimeCapsuleResponse>> {
	return apiClient<ApiResponse<TimeCapsuleResponse>>("/ai/time-capsule", {
		method: "POST",
		body: JSON.stringify(request),
	});
}

/**
 * Comments API
 */
export async function getComments(
	refId: string,
	refType: string,
	token?: string,
): Promise<ApiResponse<CommentListResponse>> {
	const headers: Record<string, string> = {};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	return apiClient<ApiResponse<CommentListResponse>>(
		`/comments?ref_id=${refId}&ref_type=${refType}`,
		{
			headers,
		},
	);
}

export async function createComment(
	request: CreateCommentRequest,
): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>("/comments", {
		method: "POST",
		body: JSON.stringify(request),
	});
}

export async function updateComment(
	id: string,
	request: UpdateCommentRequest,
): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>(`/comments/${id}`, {
		method: "PUT",
		body: JSON.stringify(request),
	});
}

export async function deleteComment(id: string): Promise<ApiResponse<void>> {
	return apiClient<ApiResponse<void>>(`/comments/${id}`, {
		method: "DELETE",
	});
}

/**
 * Auth API - OAuth 认证相关
 */

export interface AccountInfo {
	_id: string;
	provider: string;
	accountId: string;
	createdAt: string;
	oauth_avatar?: string;
	oauth_name?: string;
}

/**
 * 获取当前用户信息（需要 JWT token）
 */
export async function getCurrentUser(token: string): Promise<ApiResponse<Reader>> {
	return apiClient<ApiResponse<Reader>>("/auth/me", {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 获取用户的所有关联账号
 */
export async function getUserAccounts(token: string): Promise<ApiResponse<AccountInfo[]>> {
	return apiClient<ApiResponse<AccountInfo[]>>("/auth/accounts", {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 绑定匿名身份
 */
export async function bindAnonymousIdentity(
	data: { name: string; email: string },
	token: string,
): Promise<ApiResponse<Reader>> {
	return apiClient<ApiResponse<Reader>>("/auth/bind-anonymous", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(data),
	});
}

/**
 * 跳过绑定 - 为新 OAuth 用户创建 Reader
 */
export async function skipBind(token: string): Promise<ApiResponse<Reader>> {
	return apiClient<ApiResponse<Reader>>("/auth/skip-bind", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 关联新的 OAuth 账号
 */
export async function linkAccount(
	provider: string,
	code: string,
	token: string,
): Promise<ApiResponse<void>> {
	return apiClient<ApiResponse<void>>(`/auth/link/${provider}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ code }),
	});
}

/**
 * 创建评论（OAuth 用户，需要 JWT token）
 */
export async function createAuthComment(
	request: Omit<CreateCommentRequest, "author" | "mail">,
	token: string,
): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>("/comments", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(request),
	});
}

/**
 * 更新评论（OAuth 用户，需要 JWT token）
 */
export async function updateAuthComment(
	id: string,
	request: UpdateCommentRequest,
	token: string,
): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>(`/comments/${id}`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(request),
	});
}

/**
 * 删除评论（OAuth 用户，需要 JWT token）
 */
export async function deleteAuthComment(id: string, token: string): Promise<ApiResponse<void>> {
	return apiClient<ApiResponse<void>>(`/comments/${id}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 管理员：隐藏评论（仅评论者可见）
 */
export async function hideComment(id: string, token: string): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>(`/comments/${id}/hide`, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 管理员：显示评论（取消隐藏）
 */
export async function showComment(id: string, token: string): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>(`/comments/${id}/hide`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 管理员：置顶评论
 */
export async function pinComment(id: string, token: string): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>(`/comments/${id}/pin`, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 管理员：取消置顶评论
 */
export async function unpinComment(id: string, token: string): Promise<ApiResponse<Comment>> {
	return apiClient<ApiResponse<Comment>>(`/comments/${id}/pin`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

/**
 * 更新用户头像
 *
 * @param provider - 头像来源：'github' | 'qq' | 'gravatar'
 */
export interface UpdateAvatarRequest {
	provider: "github" | "qq" | "gravatar";
}

export async function updateAvatar(
	request: UpdateAvatarRequest,
	token: string,
): Promise<ApiResponse<Reader>> {
	return apiClient<ApiResponse<Reader>>("/auth/avatar", {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(request),
	});
}

/**
 * 生成 OAuth 登录 URL
 */
export function getOAuthUrl(provider: "github" | "qq"): string {
	return `${API_BASE_URL}/auth/oauth/${provider}`;
}

/**
 * 重定向到 OAuth 登录页面
 */
export function redirectToOAuth(provider: "github" | "qq"): void {
	if (typeof window !== "undefined") {
		localStorage.setItem("oauth_redirect_url", window.location.href);
	}
	window.location.href = getOAuthUrl(provider);
}
