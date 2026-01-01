"use client";

import type { Link, Note, PaginatedResponse, Post } from "@/types/api";

import process from "node:process";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

/**
 * 客户端 API 基础 URL
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-blog.tnxg.top/api";

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
export function usePosts(page: number, size = 10) {
  return useSWR<PaginatedResponse<Post>>(
    `${API_BASE_URL}/posts?page=${page}&size=${size}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR Infinite 获取文章列表（无限滚动）
 */
export function usePostsInfinite(pageSize = 10) {
  return useSWRInfinite<PaginatedResponse<Post>>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.has_next_page)
        return null;
      return `${API_BASE_URL}/posts?page=${pageIndex + 1}&size=${pageSize}`;
    },
    fetcher,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR 获取日记列表（单页）
 */
export function useNotes(page: number, size = 10) {
  return useSWR<PaginatedResponse<Note>>(
    `${API_BASE_URL}/notes?page=${page}&size=${size}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

/**
 * 使用 SWR Infinite 获取日记列表（无限滚动）
 */
export function useNotesInfinite(pageSize = 10) {
  return useSWRInfinite<PaginatedResponse<Note>>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.has_next_page)
        return null;
      return `${API_BASE_URL}/notes?page=${pageIndex + 1}&size=${pageSize}`;
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
export async function fetchPosts(page: number, size = 10): Promise<PaginatedResponse<Post>> {
  return fetcher(`${API_BASE_URL}/posts?page=${page}&size=${size}`);
}

export async function fetchNotes(page: number, size = 10): Promise<PaginatedResponse<Note>> {
  return fetcher(`${API_BASE_URL}/notes?page=${page}&size=${size}`);
}

export async function fetchLinks(page: number, size = 20): Promise<PaginatedResponse<Link>> {
  return fetcher(`${API_BASE_URL}/links?page=${page}&size=${size}`);
}
