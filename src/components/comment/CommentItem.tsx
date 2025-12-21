"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { SmartDate } from "@/components/common/smart-date";
import { deleteAuthComment } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { useCommentHighlight } from "./CommentContext";
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

const MAX_DEPTH = 2; // 最多显示3层（0, 1, 2）

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
	const [isDeleting, setIsDeleting] = useState(false);
	const itemRef = useRef<HTMLDivElement>(null);

	// 是否还能继续嵌套（depth < MAX_DEPTH 时可以嵌套）
	const canNest = depth < MAX_DEPTH;
	const showLine = canNest;

	// 认证状态
	const { user: authUser, isAuthenticated, token } = useAuthStore();

	// 判断是否为当前用户的评论（通过邮箱匹配）
	const isOwnComment = isAuthenticated && authUser && comment.author === authUser.name;

	// 【关键修改】：使用 Context 获取全局高亮状态
	const { highlightedId, triggerHighlight } = useCommentHighlight();

	// 处理删除评论
	const handleDelete = async () => {
		if (!confirm("确定要删除这条评论吗？") || !token) {
			return;
		}

		setIsDeleting(true);
		try {
			const result = await deleteAuthComment(comment._id, token);
			if (result.code === 200) {
				toast.success("评论删除成功");
				onRefresh();
			} else {
				toast.error(result.message || "删除失败");
			}
		} catch (error) {
			console.error("Failed to delete comment:", error);
			toast.error("删除失败，请稍后重试");
		} finally {
			setIsDeleting(false);
		}
	};

	// 判断当前组件是否应该高亮
	const isHighlighting = highlightedId === comment._id;

	// 处理点击 @ 回复对象
	const handleReplyClick = () => {
		if (!parentId)
			return;
		// 直接调用 Context 方法，不操作 DOM 属性
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
				showLine && "before:absolute before:content-[''] before:top-12 before:left-4 before:h-[calc(100%-2rem)] before:w-[2px] before:bg-linear-to-b before:from-border before:to-transparent",
			)}
		>
			{/* 评论内容区域 */}
			<dl className="relative flex flex-col gap-2 mt-6">
				{/* 高亮层 - 完全由 isHighlighting 状态控制 */}
				<AnimatePresence>
					{isHighlighting && (
						<motion.div
							key="highlight-overlay"
							initial={{ opacity: 0 }}
							animate={{ opacity: [0, 1, 1, 0] }}
							exit={{ opacity: 0 }}
							transition={{
								duration: 3,
								times: [0, 0.05, 0.4, 1],
								ease: "easeInOut",
							}}
							className="absolute -inset-2 rounded-lg pointer-events-none bg-primary/20 shadow-[0_0_0_4px_rgba(45,212,191,0.25)]"
						/>
					)}
				</AnimatePresence>

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
							<span className="text-[10px] bg-muted text-muted-foreground px-1 rounded font-mono">
								{comment.key}
							</span>
							{comment.isAdmin && <Icon icon="mingcute:safe-flash-fill" className="text-primary w-3 h-3" />}
							{comment.pin && <Icon icon="mingcute:pin-fill" className="text-red-500 w-3 h-3" />}
							{/* OAuth 来源标识 */}
							{comment.source === "from_oauth_github" && (
								<span className="flex items-center gap-1 text-[10px] bg-[#24292e] text-white px-1.5 py-0.5 rounded" title="通过 GitHub 登录">
									<Icon icon="mingcute:github-fill" className="w-2.5 h-2.5" />
								</span>
							)}
							{comment.source === "from_oauth_qq" && (
								<span className="flex items-center gap-1 text-[10px] bg-[#12b7f5] text-white px-1.5 py-0.5 rounded" title="通过 QQ 登录">
									<Icon icon="mingcute:qq-fill" className="w-2.5 h-2.5" />
								</span>
							)}
							<span className="text-muted-foreground">·</span>
							<SmartDate date={comment.created} className="text-xs text-muted-foreground" />
						</div>
					</dt>
				</div>

				{/* Content */}
				<blockquote className="ml-11">
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

						{/* 当前用户的评论显示删除/编辑按钮 */}
						{isOwnComment && (
							<>
								<motion.button
									type="button"
									onClick={() => {
										// TODO: 实现编辑功能
										console.log("Edit comment:", comment._id);
									}}
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-blue-500 transition-colors cursor-pointer"
								>
									<Icon icon="mingcute:edit-line" className="w-4 h-4" />
									<span>编辑</span>
								</motion.button>

								<motion.button
									type="button"
									onClick={handleDelete}
									disabled={isDeleting}
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
								>
									<Icon icon={isDeleting ? "svg-spinners:ring-resize" : "mingcute:delete-line"} className="w-4 h-4" />
									<span>{isDeleting ? "删除中..." : "删除"}</span>
								</motion.button>
							</>
						)}
					</dd>
				</blockquote>
			</dl>

			<div className={cn("flex flex-col", canNest && "ml-7")}>
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
