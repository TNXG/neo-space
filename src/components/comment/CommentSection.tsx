"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react/offline";
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
	const { comments, count, isLoading, refresh } = useComments(refId, refType);
	const { setRefreshComments } = useCommentRefresh();

	// 注册 refresh 函数到 Context
	useEffect(() => {
		setRefreshComments(refresh);
	}, [refresh, setRefreshComments]);

	const displayComments = comments.length > 0 ? comments : initialComments;
	const displayCount = count > 0 ? count : initialCount;

	const sortedComments = [...displayComments].sort((a, b) => {
		const dateA = new Date(a.created).getTime();
		const dateB = new Date(b.created).getTime();
		return sortBy === "newest" ? dateB - dateA : dateA - dateB;
	});

	return (
		<section className="mt-12 sm:mt-24 max-w-3xl mx-auto px-3 sm:px-4 md:px-0">
			<div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
				<h2 className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-2xl font-bold tracking-tight text-primary-900">
					<Icon icon="mingcute:message-3-line" className="w-5 h-5 sm:w-6 sm:h-6 text-accent-500 shrink-0" />
					<span>评论</span>
					<span className="text-sm sm:text-base font-normal text-primary-400 ml-0.5 sm:ml-1">
						(
						{displayCount}
						)
					</span>
				</h2>

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

			<div className={`relative ${isLoading ? "opacity-60 pointer-events-none" : ""}`}>
				<CommentList
					comments={sortedComments}
					refId={refId}
					refType={refType}
					onRefresh={refresh}
				/>
				{isLoading && displayComments.length > 0 && (
					<div className="absolute inset-0 flex items-start justify-center pt-20 z-10">
						<div className="p-3 bg-background/80 backdrop-blur-md rounded-full shadow-lg border border-primary-200">
							<Icon icon="mingcute:loading-line" className="w-5 h-5 animate-spin text-accent-500" />
						</div>
					</div>
				)}
			</div>
		</section>
	);
}

export function CommentSection(props: CommentSectionProps) {
	return (
		<CommentProvider>
			<CommentSectionContent {...props} />
		</CommentProvider>
	);
}
