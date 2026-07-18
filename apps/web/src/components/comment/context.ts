import { createContext } from "react";

export interface CommentContextType {
  highlightedId: string | null;
  triggerHighlight: (id: string) => void;
  refreshComments: (() => void) | null;
  setRefreshComments: (fn: () => void) => void;
  /** 待展开回复输入框的直接父级评论 _id；触发后保持该值直到被对应 CommentItem 消费。 */
  pendingReplyId: string | null;
  /**
   * 触发「定位到直接父级评论 + 高亮 + 在其下方展开并聚焦回复输入框」的闭环。
   *
   * 用于邮件深链 `?comment=<父级id>` 跳回站点后的引导：只展开针对「直接父级」的
   * 回复框，而非根评论或新回复本身。
   */
  triggerReplyTarget: (parentId: string) => void;
  /** 由对应 CommentItem 在展开回复框后调用，清除 pending 状态。 */
  clearPendingReply: () => void;
}

export const CommentContext = createContext<CommentContextType | null>(null);
