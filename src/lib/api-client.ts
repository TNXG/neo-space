import type { ApiResponse, Category, Link, Note, Page, PaginatedResponse, Post, Reader, Recently, User } from "@/types/api";
import process from "node:process";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Generic API client with error handling
 */
async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		headers: {
			"Content-Type": "application/json",
		},
		cache: "no-store", // Disable caching for real-time data
		...options,
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
	return apiClient<PaginatedResponse<Post>>(`/posts?page=${page}&size=${size}`);
}

export async function getPostById(id: string): Promise<ApiResponse<Post>> {
	return apiClient<ApiResponse<Post>>(`/posts/${id}`);
}

export async function getPostBySlug(slug: string): Promise<ApiResponse<Post>> {
	return apiClient<ApiResponse<Post>>(`/posts/slug/${slug}`);
}

/**
 * Pages API
 */
export async function getPageBySlug(slug: string): Promise<ApiResponse<Page>> {
	return apiClient<ApiResponse<Page>>(`/pages/${slug}`);
}

/**
 * Notes API
 */
export async function getNotes(page = 1, size = 10): Promise<PaginatedResponse<Note>> {
	return apiClient<PaginatedResponse<Note>>(`/notes?page=${page}&size=${size}`);
}

export async function getNoteById(id: string): Promise<ApiResponse<Note>> {
	return apiClient<ApiResponse<Note>>(`/notes/${id}`);
}

export async function getNoteByNid(nid: number): Promise<ApiResponse<Note>> {
	return apiClient<ApiResponse<Note>>(`/notes/nid/${nid}`);
}

/**
 * Categories API
 */
export async function getCategories(): Promise<ApiResponse<Category[]>> {
	return apiClient<ApiResponse<Category[]>>("/categories");
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
