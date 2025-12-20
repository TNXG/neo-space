"use client";

import type { Comment } from "@/types/api";
import useSWR from "swr";
import { getComments } from "@/lib/api-client";

/**
 * 使用 SWR 获取评论列表
 * 按照 AGANT.md 规范：客户端数据获取使用 SWR 直接请求后端 API
 */
export function useComments(refId: string, refType: "posts" | "pages" | "notes") {
	const { data, error, isLoading, mutate } = useSWR(
		refId ? `/comments/${refType}/${refId}` : null,
		async () => {
			const response = await getComments(refId, refType);
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
