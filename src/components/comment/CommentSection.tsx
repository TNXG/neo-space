"use client";

import type { Comment } from "@/types/api";
import { useEffect, useState } from "react";
import { useComments } from "@/hook/use-comments";
import { CommentProvider } from "./CommentContext";
import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";
import { useCommentRefresh } from "./hooks";

interface CommentSectionProps {
	refId: string;
	refType: "posts" | "pages" | "notes";
	initialComments?: Comment[];
	initialCount?: number;
}

const EMPTY_COMMENTS: Comment[] = [];

function CommentSectionContent({
	refId,
	refType,
	initialComments = EMPTY_COMMENTS,
	initialCount = 0,
}: CommentSectionProps) {
	const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

	// 将初始数据传递给 SWR，避免 hydration 不匹配
	const initialData = initialComments.length > 0
		? { comments: initialComments, count: initialCount }
		: undefined;

	const { comments, refresh } = useComments(refId, refType, initialData);
	const { setRefreshComments } = useCommentRefresh();

	// 注册 refresh 函数到 Context
	useEffect(() => {
		setRefreshComments(refresh);
	}, [refresh, setRefreshComments]);

	const displayComments = comments.length > 0 ? comments : initialComments;

	const sortedComments = [...displayComments].sort((a, b) => {
		const dateA = new Date(a.created).getTime();
		const dateB = new Date(b.created).getTime();
		return sortBy === "newest" ? dateB - dateA : dateA - dateB;
	});

	return (
		<>
			{/* 排序按钮 */}
			<div className="flex items-center justify-end mb-6 sm:mb-8">
				<div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-lg bg-primary-100 shrink-0">
					<button
						type="button"
						onClick={() => setSortBy("newest")}
						className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer ${
							sortBy === "newest" ? "bg-background text-primary-900 shadow-xs" : "text-primary-500 hover:text-primary-900"
						}`}
					>
						最新
					</button>
					<button
						type="button"
						onClick={() => setSortBy("oldest")}
						className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer ${
							sortBy === "oldest" ? "bg-background text-primary-900 shadow-xs" : "text-primary-500 hover:text-primary-900"
						}`}
					>
						最早
					</button>
				</div>
			</div>

			<div className="mb-8 sm:mb-12">
				<CommentForm refId={refId} refType={refType} onSuccess={refresh} />
			</div>

			<CommentList
				comments={sortedComments}
				refId={refId}
				refType={refType}
				onRefresh={refresh}
			/>
		</>
	);
}

export function CommentSection(props: CommentSectionProps) {
	return (
		<CommentProvider>
			<CommentSectionContent {...props} />
		</CommentProvider>
	);
}
