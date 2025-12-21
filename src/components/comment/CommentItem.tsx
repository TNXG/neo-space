"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { SmartDate } from "@/components/common/smart-date";
import { cn } from "@/lib/utils";
import { CommentForm } from "./CommentForm";

interface CommentItemProps {
	comment: Comment;
	refId: string;
	refType: "posts" | "pages" | "notes";
	onRefresh: () => void;
	depth?: number;
	parentAuthor?: string;
	parentId?: string;
}

const MAX_DEPTH = 4;

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
	const [highlightKey, setHighlightKey] = useState(0);
	const itemRef = useRef<HTMLDivElement>(null);
	const showLine = depth < MAX_DEPTH;

	// 监听高亮触发
	useEffect(() => {
		const element = itemRef.current;
		if (!element)
			return;

		let clearTimer: NodeJS.Timeout | null = null;

		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === "attributes" && mutation.attributeName === "data-highlight-trigger") {
					const triggerValue = element.getAttribute("data-highlight-trigger");
					// 只有当属性值存在时才触发高亮
					if (triggerValue) {
						// 通过改变 key 来触发重新动画
						setHighlightKey(prev => prev + 1);

						// 清除之前的定时器
						if (clearTimer) {
							clearTimeout(clearTimer);
						}

						// 3秒后清除触发标记，避免重复触发
						clearTimer = setTimeout(() => {
							element.removeAttribute("data-highlight-trigger");
						}, 3000);
					}
				}
			});
		});

		observer.observe(element, { attributes: true });

		return () => {
			observer.disconnect();
			if (clearTimer) {
				clearTimeout(clearTimer);
			}
		};
	}, []);

	// 处理点击 @ 回复对象，高亮父评论
	const handleReplyClick = () => {
		if (!parentId)
			return;

		const parentElement = document.getElementById(parentId);
		if (parentElement) {
			// 滚动到父评论
			parentElement.scrollIntoView({ behavior: "smooth", block: "center" });

			// 直接设置属性触发高亮
			parentElement.setAttribute("data-highlight-trigger", Date.now().toString());
		}
	};

	return (
		<motion.div
			ref={itemRef}
			id={comment._id}
			data-comment-highlight
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
			className={cn(
				"relative group/item rounded-lg overflow-visible",
				showLine && "before:absolute before:content-[''] before:top-12 before:left-4 before:h-[calc(100%-2rem)] before:w-[2px] before:bg-linear-to-b before:from-border before:to-transparent",
			)}
		>
			{/* 评论内容区域（仅此区域高亮） */}
			<dl className="relative flex flex-col gap-2 mt-6">
				{/* 高亮层 - 仅覆盖当前评论内容 */}
				{highlightKey > 0 && (
					<motion.div
						key={highlightKey}
						initial={{ opacity: 0 }}
						animate={{ opacity: [0, 1, 1, 0] }}
						transition={{
							duration: 3,
							times: [0, 0.05, 0.4, 1],
							ease: "easeInOut",
						}}
						className="absolute -inset-2 rounded-lg pointer-events-none bg-primary/20 shadow-[0_0_0_4px_rgba(45,212,191,0.25)]"
					/>
				)}

				{/* Header: 头像 + 信息 */}
				<div className="flex items-center gap-2 relative z-10">
					<img
						src={comment.avatar || `https://ui-avatars.com/api/?name=${comment.author}&background=random`}
						alt={comment.author}
						className="w-9 h-9 border border-border rounded-full bg-background object-cover"
					/>

					<dt className="flex flex-col gap-0.5 min-w-0">
						<div className="flex items-center gap-2 text-sm">
							<b className={cn(comment.isAdmin ? "text-primary" : "text-foreground")}>
								{comment.author}
							</b>

							{/* 楼层号 */}
							<span className="text-[10px] bg-muted text-muted-foreground px-1 rounded font-mono">
								{comment.key}
							</span>

							{/* 徽章 */}
							{comment.isAdmin && <Icon icon="mingcute:safe-flash-fill" className="text-primary w-3 h-3" />}
							{comment.pin && <Icon icon="mingcute:pin-fill" className="text-red-500 w-3 h-3" />}

							<span className="text-muted-foreground">·</span>
							<SmartDate date={comment.created} className="text-xs text-muted-foreground" />
						</div>
					</dt>
				</div>

				{/* Content: 对应 Svelte 的 blockquote class="ms-11" */}
				<blockquote className="ml-11">
					{/* 回复引用 (Flat Mode 逻辑保留) */}
					{parentAuthor && parentId && depth >= 1 && (
						<motion.button
							type="button"
							onClick={handleReplyClick}
							whileHover={{ x: 2 }}
							whileTap={{ scale: 0.98 }}
							className="flex items-center gap-1 mb-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer group/reply"
						>
							<Icon icon="mingcute:share-forward-line" className="group-hover/reply:translate-x-0.5 transition-transform" />
							<span>回复</span>
							<span className="font-bold text-foreground group-hover/reply:text-primary">
								@
								{parentAuthor}
							</span>
						</motion.button>
					)}

					<div className="prose prose-sm prose-stone max-w-none text-foreground/90 leading-relaxed">
						<CommentMarkdown content={comment.text} />
					</div>

					{/* Actions: 对应 Svelte 的 dd class="flex items-center gap-4 mt-2" */}
					<dd className="flex items-center gap-4 mt-2">
						<motion.button
							type="button"
							onClick={() => setReplyView(!replyView)}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							className={cn(
								"flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer",
								replyView && "text-primary",
							)}
						>
							<Icon icon="mingcute:reply-line" className="w-4 h-4" />
							<span>回复</span>
						</motion.button>
					</dd>
				</blockquote>
			</dl>
			{/* 高亮层结束 */}

			<div className={cn("flex flex-col", "ml-7")}>
				{/* Reply Form with Animation */}
				<AnimatePresence mode="wait">
					{replyView && (
						<motion.div
							initial={{ opacity: 0, height: 0, y: -10 }}
							animate={{ opacity: 1, height: "auto", y: 0 }}
							exit={{ opacity: 0, height: 0, y: -10 }}
							transition={{ duration: 0.3, ease: "easeInOut" }}
							className="mb-4 mt-2 overflow-hidden"
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

				{/* Recursive Children */}
				{comment.children && comment.children.map(child => (
					<CommentItem
						key={child._id}
						comment={child}
						refId={refId}
						refType={refType}
						onRefresh={onRefresh}
						depth={depth + 1}
						parentAuthor={comment.author}
						parentId={comment._id}
					/>
				))}
			</div>
		</motion.div>
	);
}
