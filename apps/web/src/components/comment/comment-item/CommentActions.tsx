"use client";

import type { Comment } from "@/types/api";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteAuthComment, hideComment, pinComment, showComment, unpinComment } from "@/lib/api-client";
import { Icon } from "@/lib/inline-icon";
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
  const t = useTranslations();
  // 处理删除评论
  const handleDelete = () => {
    if (!token)
      return;

    toast(t("comment.deleteConfirm"), {
      action: {
        label: t("comment.confirmDelete"),
        onClick: async () => {
          setIsDeleting(true);
          try {
            const result = await deleteAuthComment(comment._id, token);
            if (result.code === 200) {
              toast.success(t("comment.deleteSuccess"));
              onRefresh();
            } else {
              toast.error(result.message || t("comment.deleteFailed"));
            }
          } catch (error) {
            console.error("Failed to delete comment:", error);
            toast.error(t("comment.deleteRetry"));
          } finally {
            setIsDeleting(false);
          }
        },
      },
      cancel: {
        label: t("comment.cancel"),
        onClick: () => {},
      },
    });
  };

  // 处理编辑评论
  const handleEdit = () => {
    setEditView(true);
    if (replyView)
      setReplyView(false);
  };

  // 处理隐藏/显示评论（管理员功能）
  const handleToggleHidden = async () => {
    if (!token || !isCurrentUserAdmin)
      return;

    const action = comment.isWhispers ? t("comment.show") : t("comment.hide");
    toast(t("comment.toggleCommentConfirm", { action }), {
      action: {
        label: t("comment.confirmAction", { action }),
        onClick: async () => {
          try {
            const result = comment.isWhispers
              ? await showComment(comment._id, token)
              : await hideComment(comment._id, token);

            if (result.code === 200) {
              toast.success(t("comment.actionSuccess", { action }));
              onRefresh();
            } else {
              toast.error(result.message || t("comment.actionFailed", { action }));
            }
          } catch (error) {
            console.error(`Failed to ${action} comment:`, error);
            toast.error(t("comment.actionRetry", { action }));
          }
        },
      },
      cancel: {
        label: t("comment.cancel"),
        onClick: () => {},
      },
    });
  };

  // 处理置顶/取消置顶评论（管理员功能）
  const handleTogglePin = async () => {
    if (!token || !isCurrentUserAdmin)
      return;

    const action = comment.pin ? t("comment.unpin") : t("comment.pin");
    toast(t("comment.toggleCommentConfirm", { action }), {
      action: {
        label: t("comment.confirmAction", { action }),
        onClick: async () => {
          try {
            const result = comment.pin
              ? await unpinComment(comment._id, token)
              : await pinComment(comment._id, token);

            if (result.code === 200) {
              toast.success(t("comment.actionSuccess", { action }));
              onRefresh();
            } else {
              toast.error(result.message || t("comment.actionFailed", { action }));
            }
          } catch (error) {
            console.error(`Failed to ${action} comment:`, error);
            toast.error(t("comment.actionRetry", { action }));
          }
        },
      },
      cancel: {
        label: t("comment.cancel"),
        onClick: () => {},
      },
    });
  };

  return (
    <dd className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2.5 sm:mt-2">
      <motion.button
        type="button"
        onClick={() => {
          setReplyView(!replyView);
          if (editView)
            setEditView(false);
        }}
        disabled={editView}
        whileTap={{ scale: editView ? 1 : 0.95 }}
        className={cn(
          "flex items-center gap-1.5 text-xs sm:text-xs font-medium transition-colors cursor-pointer min-h-[32px] sm:min-h-0 px-1",
          editView
            ? "text-muted-foreground/50 cursor-not-allowed"
            : replyView
              ? "text-primary hover:text-primary"
              : "text-muted-foreground hover:text-primary",
        )}
      >
        <Icon icon="mingcute:share-forward-line" className="w-4 h-4 sm:w-4 sm:h-4" />
        <span>{t("comment.reply")}</span>
      </motion.button>

      {/* 当前用户的评论显示删除/编辑按钮 */}
      {isOwnComment && (
        <>
          <motion.button
            type="button"
            onClick={handleEdit}
            disabled={editView}
            whileTap={{ scale: editView ? 1 : 0.95 }}
            className={cn(
              "flex items-center gap-1.5 text-xs sm:text-xs font-medium transition-colors cursor-pointer min-h-[32px] sm:min-h-0 px-1",
              editView
                ? "text-blue-500 cursor-default"
                : "text-muted-foreground hover:text-blue-500",
            )}
          >
            <Icon icon="mingcute:edit-line" className="w-4 h-4 sm:w-4 sm:h-4" />
            <span>{editView ? t("comment.editing") : t("comment.edit")}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || editView}
            whileTap={{ scale: (isDeleting || editView) ? 1 : 0.95 }}
            className={cn(
              "flex items-center gap-1.5 text-xs sm:text-xs font-medium transition-colors min-h-[32px] sm:min-h-0 px-1",
              (isDeleting || editView)
                ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                : "text-muted-foreground hover:text-red-500 cursor-pointer",
            )}
          >
            <Icon icon={isDeleting ? "mingcute:loading-line" : "mingcute:delete-line"} className={`w-4 h-4 sm:w-4 sm:h-4${isDeleting ? " animate-spin" : ""}`} />
            <span>{isDeleting ? t("comment.deleting") : t("comment.delete")}</span>
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
            whileTap={{ scale: editView ? 1 : 0.95 }}
            className={cn(
              "flex items-center gap-1.5 text-xs sm:text-xs font-medium transition-colors cursor-pointer min-h-[32px] sm:min-h-0 px-1",
              editView
                ? "text-muted-foreground/50 cursor-not-allowed"
                : comment.isWhispers
                  ? "text-orange-500 hover:text-orange-600"
                  : "text-muted-foreground hover:text-orange-500",
            )}
          >
            <Icon icon={comment.isWhispers ? "mingcute:eye-line" : "mingcute:eye-close-line"} className="w-4 h-4 sm:w-4 sm:h-4" />
            <span>{comment.isWhispers ? t("comment.show") : t("comment.hide")}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={handleTogglePin}
            disabled={editView}
            whileTap={{ scale: editView ? 1 : 0.95 }}
            className={cn(
              "flex items-center gap-1.5 text-xs sm:text-xs font-medium transition-colors cursor-pointer min-h-[32px] sm:min-h-0 px-1",
              editView
                ? "text-muted-foreground/50 cursor-not-allowed"
                : comment.pin
                  ? "text-red-500 hover:text-red-600"
                  : "text-muted-foreground hover:text-red-500",
            )}
          >
            <Icon icon={comment.pin ? "mingcute:pin-fill" : "mingcute:pin-line"} className="w-4 h-4 sm:w-4 sm:h-4" />
            <span>{comment.pin ? t("comment.unpin") : t("comment.pin")}</span>
          </motion.button>
        </>
      )}
    </dd>
  );
}
