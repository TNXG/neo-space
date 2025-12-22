"use client";

import type { Comment } from "@/types/api";
import useSWR from "swr";
import { getComments } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * 使用 SWR 获取评论列表
 * 按照 AGANT.md 规范：客户端数据获取使用 SWR 直接请求后端 API
 * 
 * 传递 JWT token 以便后端根据用户身份过滤评论：
 * - 管理员：可以看到所有评论（包括隐藏的）
 * - 普通用户：可以看到公开评论 + 自己的私密评论
 * - 匿名用户：只能看到公开评论
 */
export function useComments(refId: string, refType: "posts" | "pages" | "notes") {
	const token = useAuthStore(state => state.token);
	
	const { data, error, isLoading, mutate } = useSWR(
		refId ? [`/comments/${refType}/${refId}`, token] : null,
		async () => {
			const response = await getComments(refId, refType, token ?? undefined);
			return response.data;
		},
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: true,
		},
	);

	return {
		comments: (data?.comments || []) as Comment[],
		count: data?.count || 0,
		isLoading,
		isError: error,
		refresh: mutate,
	};
}
