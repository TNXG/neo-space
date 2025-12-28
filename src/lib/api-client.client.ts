"use client";
import type { Link, Note, PaginatedResponse, Post } from "@/types/api";

import process from "node:process";

/**
 * 客户端 API 基础 URL
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-blog.tnxg.top/api";

/**
 * 客户端获取文章列表（用于无限滚动）
 */
export async function fetchPosts(page: number, size = 10): Promise<PaginatedResponse<Post>> {
  const response = await fetch(`${API_BASE_URL}/posts?page=${page}&size=${size}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

/**
 * 客户端获取日记列表（用于无限滚动）
 */
export async function fetchNotes(page: number, size = 10): Promise<PaginatedResponse<Note>> {
  const response = await fetch(`${API_BASE_URL}/notes?page=${page}&size=${size}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

/**
 * 客户端获取友链列表（用于无限滚动）
 */
export async function fetchLinks(page: number, size = 20): Promise<PaginatedResponse<Link>> {
  const response = await fetch(`${API_BASE_URL}/links?page=${page}&size=${size}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}
