"use client";

import type { ApiResponse, Link, Note, PaginatedResponse, Post, SearchResults } from "@/types/api";

import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

import { API_BASE_URL } from "./api-client";

/**
 * 客户端使用服务端的 API_BASE_URL 配置
 * 避免重复定义，确保配置统一
 */
export { API_BASE_URL };

function withLangParam(url: string, lang?: string): string {
  if (!lang || lang === "zh") {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}lang=${encodeURIComponent(lang)}`;
}

/**
 * 通用 fetcher
 */
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

/**
 * 使用 SWR 获取文章列表（单页）
 */
export function usePosts(page: number, size = 10, lang?: string) {
  return useSWR<PaginatedResponse<Post>>(
    withLangParam(`${API_BASE_URL}/posts?page=${page}&size=${size}`, lang),
    fetcher,
    { revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR Infinite 获取文章列表（无限滚动）
 */
export function usePostsInfinite(pageSize = 10, lang?: string) {
  return useSWRInfinite<PaginatedResponse<Post>>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.has_next_page)
        return null;
      return withLangParam(`${API_BASE_URL}/posts?page=${pageIndex + 1}&size=${pageSize}`, lang);
    },
    fetcher,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR 获取日记列表（单页）
 */
export function useNotes(page: number, size = 10, lang?: string) {
  return useSWR<PaginatedResponse<Note>>(
    withLangParam(`${API_BASE_URL}/notes?page=${page}&size=${size}`, lang),
    fetcher,
    { revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR Infinite 获取日记列表（无限滚动）
 */
export function useNotesInfinite(pageSize = 10, lang?: string) {
  return useSWRInfinite<PaginatedResponse<Note>>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.has_next_page)
        return null;
      return withLangParam(`${API_BASE_URL}/notes?page=${pageIndex + 1}&size=${pageSize}`, lang);
    },
    fetcher,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR 获取友链列表（单页）
 */
export function useLinks(page: number, size = 20) {
  return useSWR<PaginatedResponse<Link>>(
    `${API_BASE_URL}/links?page=${page}&size=${size}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR Infinite 获取友链列表（无限滚动）
 */
export function useLinksInfinite(pageSize = 20) {
  return useSWRInfinite<PaginatedResponse<Link>>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.has_next_page)
        return null;
      return `${API_BASE_URL}/links?page=${pageIndex + 1}&size=${pageSize}`;
    },
    fetcher,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );
}

// 保留原有的 fetch 函数供 SWR fetcher 使用
export async function fetchPosts(page: number, size = 10, lang?: string): Promise<PaginatedResponse<Post>> {
  return fetcher(withLangParam(`${API_BASE_URL}/posts?page=${page}&size=${size}`, lang));
}

export async function fetchNotes(page: number, size = 10, lang?: string): Promise<PaginatedResponse<Note>> {
  return fetcher(withLangParam(`${API_BASE_URL}/notes?page=${page}&size=${size}`, lang));
}

export async function fetchLinks(page: number, size = 20): Promise<PaginatedResponse<Link>> {
  return fetcher(`${API_BASE_URL}/links?page=${page}&size=${size}`);
}

/**
 * 使用 SWR 进行搜索
 *
 * @param query - 搜索关键词（为空时不发起请求）
 * @param type_ - 搜索类型：'post' | 'note'，不传则搜索全部
 * @param limit - 每种类型的最大结果数
 * @param semantic - 是否启用语义搜索（混合搜索）
 */
export function useSearch(query: string, type_?: "post" | "note", limit = 10, semantic = false) {
  const trimmed = query.trim();
  const key = trimmed
    ? `${API_BASE_URL}/search?q=${encodeURIComponent(trimmed)}${type_ ? `&type=${type_}` : ""}&limit=${limit}${semantic ? "&semantic=true" : ""}`
    : null;

  return useSWR<ApiResponse<SearchResults>>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}
