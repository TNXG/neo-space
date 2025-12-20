"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useComments } from "@/hook/use-comments";
import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";

interface CommentSectionProps {
	refId: string;
	refType: "posts" | "pages" | "notes";
	initialComments?: Comment[];
	initialCount?: number;
}

const EMPTY_COMMENTS: Comment[] = [];

/**
 * 评论区主容器
 * 遵循 AGANT.md 规范：Client Component 作为交互叶子节点
 */
export function CommentSection({
	refId,
	refType,
	initialComments = EMPTY_COMMENTS,
	initialCount = 0,
}: CommentSectionProps) {
	const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

	// SWR 数据获取
	const { comments, count, isLoading, refresh } = useComments(refId, refType);

	const displayComments = comments.length > 0 ? comments : initialComments;
	const displayCount = count > 0 ? count : initialCount;

	// 前端排序逻辑 (假设API不负责排序，或者作为客户端的即时反馈)
	const sortedComments = [...displayComments].sort((a, b) => {
		const dateA = new Date(a.created).getTime();
		const dateB = new Date(b.created).getTime();
		return sortBy === "newest" ? dateB - dateA : dateA - dateB;
	});

	return (
		<section className="mt-16 sm:mt-24 max-w-3xl mx-auto px-4 sm:px-0">
			{/* 头部区域 */}
			<div className="flex items-center justify-between mb-8">
				<h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
					<Icon icon="lucide:message-square" className="w-6 h-6 text-teal-500" />
					<span>评论</span>
					<span className="text-base font-normal text-zinc-400 ml-1">
						(
						{displayCount}
						)
					</span>
				</h2>

				{/* 排序切换 */}
				<div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
					<button
						type="button"
						onClick={() => setSortBy("newest")}
						className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
							sortBy === "newest"
								? "bg-white text-zinc-900 shadow-xs"
								: "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
						}`}
					>
						最新
					</button>
					<button
						type="button"
						onClick={() => setSortBy("oldest")}
						className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
							sortBy === "oldest"
								? "bg-white text-zinc-900 shadow-xs"
								: "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
						}`}
					>
						最早
					</button>
				</div>
			</div>

			{/* 发送评论表单 (Always Visible) */}
			<div className="mb-12">
				<CommentForm
					refId={refId}
					refType={refType}
					onSuccess={refresh}
				/>
			</div>

			{/* 评论列表 */}
			<div className={`relative ${isLoading ? "opacity-60 pointer-events-none" : ""}`}>
				<CommentList
					comments={sortedComments}
					refId={refId}
					refType={refType}
					onRefresh={refresh}
				/>

				{/* Loading 遮罩 */}
				{isLoading && displayComments.length > 0 && (
					<div className="absolute inset-0 flex items-start justify-center pt-20 z-10">
						<div className="p-3 bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700">
							<Icon icon="lucide:loader-2" className="w-5 h-5 animate-spin text-teal-500" />
						</div>
					</div>
				)}
			</div>
		</section>
	);
}
