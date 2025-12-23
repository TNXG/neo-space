"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { CommentForm } from "../CommentForm";
import { useCommentHighlight } from "../hooks";
import { CommentActions } from "./CommentActions";
import { CommentEditForm } from "./CommentEditForm";
import { CommentHeader } from "./CommentHeader";

interface CommentItemProps {
	comment: Comment;
	refId: string;
	refType: "posts" | "pages" | "notes";
	onRefresh: () => void;
	depth?: number;
	parentAuthor?: string;
	parentId?: string;
}

const MAX_DEPTH = 2;

export function CommentItem({
	comment,
	refId,
	refType,
	onRefresh,
	depth = 0,
	parentAuthor,
	parentId,
}: CommentItemProps) {
	const [replyView, setReplyView] = useState(false);
	const [editView, setEditView] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const itemRef = useRef<HTMLDivElement>(null);

	const canNest = depth < MAX_DEPTH;
	const showLine = canNest;

	const { user: authUser, isAuthenticated, token } = useAuthStore();
	const isOwnComment = isAuthenticated && authUser && comment.author === authUser.name;
	const isCurrentUserAdmin = isAuthenticated && authUser?.isOwner;
	const { highlightedId, triggerHighlight } = useCommentHighlight();
	const isHighlighting = highlightedId === comment._id;

	// 处理点击 @ 回复对象
	const handleReplyClick = () => {
		if (!parentId)
			return;
		triggerHighlight(parentId);
	};

	return (
		<motion.div
			ref={itemRef}
			id={comment._id}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
			className={cn(
				"relative group/item rounded-lg overflow-visible",
				showLine && "before:absolute before:content-[''] before:top-10 sm:before:top-12 before:left-3 sm:before:left-4 before:h-[calc(100%-1.5rem)] sm:before:h-[calc(100%-2rem)] before:w-[2px] before:bg-linear-to-b before:from-border before:to-transparent",
			)}
		>
			{/* 评论内容区域 */}
			<dl className="relative flex flex-col gap-1.5 sm:gap-2 mt-4 sm:mt-6">
				{/* 高亮层 */}
				<AnimatePresence>
					{isHighlighting && (
						<motion.div
							key="highlight-overlay"
							initial={{ opacity: 0 }}
							animate={{ opacity: [0, 1, 1, 0] }}
							exit={{ opacity: 0 }}
							transition={{ duration: 3, times: [0, 0.05, 0.4, 1], ease: "easeInOut" }}
							className="absolute -inset-1.5 sm:-inset-2 rounded-lg pointer-events-none bg-primary/20 shadow-[0_0_0_4px_rgba(45,212,191,0.25)]"
						/>
					)}
				</AnimatePresence>

				{/* Header */}
				<CommentHeader comment={comment} />

				{/* Content */}
				<blockquote className="ml-9 sm:ml-11">
					{parentAuthor && parentId && depth >= 1 && (
						<motion.button
							type="button"
							onClick={handleReplyClick}
							whileHover={{ x: 2 }}
							whileTap={{ scale: 0.98 }}
							className="flex items-center gap-1 mb-1 text-[11px] sm:text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer group/reply"
						>
							<Icon icon="mingcute:share-forward-line" className="group-hover/reply:translate-x-0.5 transition-transform size-3 sm:size-3.5" />
							<span>回复</span>
							<span className="font-bold text-foreground group-hover/reply:text-primary truncate max-w-[80px] sm:max-w-none">
								@
								{parentAuthor}
							</span>
						</motion.button>
					)}

					{editView && token
						? (
								<CommentEditForm
									commentId={comment._id}
									originalText={comment.text}
									token={token}
									onSave={() => {
										setEditView(false);
										onRefresh();
									}}
									onCancel={() => setEditView(false)}
								/>
							)
						: (
								<div className="prose prose-sm prose-stone max-w-none text-foreground/90 leading-relaxed text-sm sm:text-base">
									<CommentMarkdown content={comment.text} />
								</div>
							)}

					<CommentActions
						comment={comment}
						token={token}
						isOwnComment={!!isOwnComment}
						isCurrentUserAdmin={!!isCurrentUserAdmin}
						editView={editView}
						replyView={replyView}
						isDeleting={isDeleting}
						setReplyView={setReplyView}
						setEditView={setEditView}
						setIsDeleting={setIsDeleting}
						onRefresh={onRefresh}
					/>
				</blockquote>
			</dl>

			<div className={cn("flex flex-col", canNest && "ml-5 sm:ml-7")}>
				<AnimatePresence mode="wait">
					{replyView && (
						<motion.div
							initial={{ opacity: 0, height: 0, y: -10 }}
							animate={{ opacity: 1, height: "auto", y: 0 }}
							exit={{ opacity: 0, height: 0, y: -10 }}
							transition={{ duration: 0.3, ease: "easeInOut" }}
							className="mb-3 sm:mb-4 mt-1.5 sm:mt-2 overflow-visible"
						>
							<CommentForm
								refId={refId}
								refType={refType}
								parentId={comment._id}
								autoFocus
								onSuccess={() => {
									setReplyView(false);
									onRefresh();
								}}
								onCancel={() => setReplyView(false)}
							/>
						</motion.div>
					)}
				</AnimatePresence>

				{comment.children && comment.children.map(child => (
					<CommentItem
						key={child._id}
						comment={child}
						refId={refId}
						refType={refType}
						onRefresh={onRefresh}
						depth={canNest ? depth + 1 : depth}
						parentAuthor={comment.author}
						parentId={comment._id}
					/>
				))}
			</div>
		</motion.div>
	);
}
