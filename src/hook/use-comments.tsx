"use client";

import type { Comment } from "@/types/api";
import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { getComments } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * 检查评论列表中是否有待审核的评论
 */
function hasPendingComments(comments: Comment[]): boolean {
	const checkComment = (comment: Comment): boolean => {
		if (comment.state === 3) return true; // CommentState.PENDING
		if (comment.children && comment.children.length > 0) {
			return comment.children.some(checkComment);
		}
		return false;
	};

	return comments.some(checkComment);
}

/**
 * 使用 SWR 获取评论列表
 *
 * 自动刷新策略：
 * - 有待审核评论时，每 5 秒刷新一次
 * - 没有待审核评论时，停止轮询
 */
export function useComments(refId: string, refType: "posts" | "pages" | "notes") {
	const token = useAuthStore(state => state.token);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

	const hasPending = useMemo(() => {
		return hasPendingComments(data?.comments || []);
	}, [data?.comments]);

	// 手动控制轮询：有待审核评论时启动，没有时停止
	useEffect(() => {
		// 清除之前的定时器
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		// 如果有待审核评论，启动轮询
		if (hasPending) {
			intervalRef.current = setInterval(() => {
				mutate();
			}, 5000);
		}

		// 清理函数
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [hasPending, mutate]);

	return {
		comments: (data?.comments || []) as Comment[],
		count: data?.count || 0,
		isLoading,
		isError: error,
		refresh: mutate,
		hasPending,
	};
}
