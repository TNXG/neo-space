"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { motion } from "motion/react";
import { toast } from "sonner";
import { deleteAuthComment, hideComment, pinComment, showComment, unpinComment } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CommentActionsProps {
	comment: Comment;
	token: string | null;
	isOwnComment: boolean;
	isCurrentUserAdmin: boolean;
	editView: boolean;
	replyView: boolean;
	isDeleting: boolean;
	setReplyView: (v: boolean) => void;
	setEditView: (v: boolean) => void;
	setIsDeleting: (v: boolean) => void;
	onRefresh: () => void;
}

/**
 * 评论操作按钮组件 - 回复、编辑、删除、管理员操作
 */
export function CommentActions({
	comment,
	token,
	isOwnComment,
	isCurrentUserAdmin,
	editView,
	replyView,
	isDeleting,
	setReplyView,
	setEditView,
	setIsDeleting,
	onRefresh,
}: CommentActionsProps) {
	// 处理删除评论
	const handleDelete = () => {
		if (!token) return;

		toast("确定要删除这条评论吗？", {
			action: {
				label: "确认删除",
				onClick: async () => {
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
				},
			},
			cancel: {
				label: "取消",
				onClick: () => {},
			},
		});
	};

	// 处理编辑评论
	const handleEdit = () => {
		setEditView(true);
		if (replyView) setReplyView(false);
	};

	// 处理隐藏/显示评论（管理员功能）
	const handleToggleHidden = async () => {
		if (!token || !isCurrentUserAdmin) return;

		const action = comment.isWhispers ? "显示" : "隐藏";
		toast(`确定要${action}这条评论吗？`, {
			action: {
				label: `确认${action}`,
				onClick: async () => {
					try {
						const result = comment.isWhispers
							? await showComment(comment._id, token)
							: await hideComment(comment._id, token);

						if (result.code === 200) {
							toast.success(`评论${action}成功`);
							onRefresh();
						} else {
							toast.error(result.message || `${action}失败`);
						}
					} catch (error) {
						console.error(`Failed to ${action} comment:`, error);
						toast.error(`${action}失败，请稍后重试`);
					}
				},
			},
			cancel: {
				label: "取消",
				onClick: () => {},
			},
		});
	};

	// 处理置顶/取消置顶评论（管理员功能）
	const handleTogglePin = async () => {
		if (!token || !isCurrentUserAdmin) return;

		const action = comment.pin ? "取消置顶" : "置顶";
		toast(`确定要${action}这条评论吗？`, {
			action: {
				label: `确认${action}`,
				onClick: async () => {
					try {
						const result = comment.pin
							? await unpinComment(comment._id, token)
							: await pinComment(comment._id, token);

						if (result.code === 200) {
							toast.success(`评论${action}成功`);
							onRefresh();
						} else {
							toast.error(result.message || `${action}失败`);
						}
					} catch (error) {
						console.error(`Failed to ${action} comment:`, error);
						toast.error(`${action}失败，请稍后重试`);
					}
				},
			},
			cancel: {
				label: "取消",
				onClick: () => {},
			},
		});
	};

	return (
		<dd className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
			<motion.button
				type="button"
				onClick={() => {
					setReplyView(!replyView);
					if (editView) setEditView(false);
				}}
				disabled={editView}
				whileHover={{ scale: editView ? 1 : 1.05 }}
				whileTap={{ scale: editView ? 1 : 0.95 }}
				className={cn(
					"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
					editView
						? "text-muted-foreground/50 cursor-not-allowed"
						: replyView
							? "text-primary hover:text-primary"
							: "text-muted-foreground hover:text-primary",
				)}
			>
				<Icon icon="mingcute:share-forward-line" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				<span>回复</span>
			</motion.button>

			{/* 当前用户的评论显示删除/编辑按钮 */}
			{isOwnComment && (
				<>
					<motion.button
						type="button"
						onClick={handleEdit}
						disabled={editView}
						whileHover={{ scale: editView ? 1 : 1.05 }}
						whileTap={{ scale: editView ? 1 : 0.95 }}
						className={cn(
							"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
							editView
								? "text-blue-500 cursor-default"
								: "text-muted-foreground hover:text-blue-500",
						)}
					>
						<Icon icon="mingcute:edit-line" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
						<span>{editView ? "编辑中" : "编辑"}</span>
					</motion.button>

					<motion.button
						type="button"
						onClick={handleDelete}
						disabled={isDeleting || editView}
						whileHover={{ scale: (isDeleting || editView) ? 1 : 1.05 }}
						whileTap={{ scale: (isDeleting || editView) ? 1 : 0.95 }}
						className={cn(
							"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors",
							(isDeleting || editView)
								? "text-muted-foreground/50 cursor-not-allowed opacity-50"
								: "text-muted-foreground hover:text-red-500 cursor-pointer",
						)}
					>
						<Icon icon={isDeleting ? "mingcute:loading-line" : "mingcute:delete-line"} className={`w-3.5 h-3.5 sm:w-4 sm:h-4${isDeleting ? " animate-spin" : ""}`} />
						<span>{isDeleting ? "删除中..." : "删除"}</span>
					</motion.button>
				</>
			)}

			{/* 管理员操作按钮 */}
			{isCurrentUserAdmin && (
				<>
					<motion.button
						type="button"
						onClick={handleToggleHidden}
						disabled={editView}
						whileHover={{ scale: editView ? 1 : 1.05 }}
						whileTap={{ scale: editView ? 1 : 0.95 }}
						className={cn(
							"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
							editView
								? "text-muted-foreground/50 cursor-not-allowed"
								: comment.isWhispers
									? "text-orange-500 hover:text-orange-600"
									: "text-muted-foreground hover:text-orange-500",
						)}
					>
						<Icon icon={comment.isWhispers ? "mingcute:eye-line" : "mingcute:eye-close-line"} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
						<span>{comment.isWhispers ? "显示" : "隐藏"}</span>
					</motion.button>

					<motion.button
						type="button"
						onClick={handleTogglePin}
						disabled={editView}
						whileHover={{ scale: editView ? 1 : 1.05 }}
						whileTap={{ scale: editView ? 1 : 0.95 }}
						className={cn(
							"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
							editView
								? "text-muted-foreground/50 cursor-not-allowed"
								: comment.pin
									? "text-red-500 hover:text-red-600"
									: "text-muted-foreground hover:text-red-500",
						)}
					>
						<Icon icon={comment.pin ? "mingcute:pin-fill" : "mingcute:pin-line"} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
						<span>{comment.pin ? "取消置顶" : "置顶"}</span>
					</motion.button>
				</>
			)}
		</dd>
	);
}
