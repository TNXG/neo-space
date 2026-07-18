"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { CommentContext } from "./context";

export function CommentProvider({ children }: { children: ReactNode }) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [refreshComments, setRefreshComments] = useState<(() => void) | null>(null);
  // 待展开回复输入框的直接父级评论 _id；由邮件深链 / @ 回复跳转触发
  const [pendingReplyId, setPendingReplyId] = useState<string | null>(null);

  const triggerHighlight = useCallback((id: string) => {
    // 1. 设置当前高亮ID
    setHighlightedId(id);

    // 2. 滚动到该元素 (DOM 操作仅用于滚动)
    const element = document.getElementById(`comment-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // 3. 3秒后自动清除状态
    const timer = setTimeout(() => {
      setHighlightedId(current => (current === id ? null : current));
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  /**
   * 触发回复闭环：高亮 + 滚动到直接父级评论，并标记待展开回复框。
   * 对应的 CommentItem 检测到 pendingReplyId === 自身 _id 时，展开并聚焦回复输入框，
   * 随后调用 clearPendingReply 清除状态，避免重复展开。
   */
  const triggerReplyTarget = useCallback((parentId: string) => {
    setPendingReplyId(parentId);
    setHighlightedId(parentId);
    const element = document.getElementById(`comment-${parentId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // 高亮 3 秒后自动清除；pending 状态由 CommentItem 消费时清除
    const timer = setTimeout(() => {
      setHighlightedId(current => (current === parentId ? null : current));
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const clearPendingReply = useCallback(() => {
    setPendingReplyId(null);
  }, []);

  const handleSetRefreshComments = useCallback((fn: () => void) => {
    setRefreshComments(() => fn);
  }, []);

  const contextValue = useMemo(() => ({
    highlightedId,
    triggerHighlight,
    refreshComments,
    setRefreshComments: handleSetRefreshComments,
    pendingReplyId,
    triggerReplyTarget,
    clearPendingReply,
  }), [
    highlightedId,
    triggerHighlight,
    refreshComments,
    handleSetRefreshComments,
    pendingReplyId,
    triggerReplyTarget,
    clearPendingReply,
  ]);

  return (
    <CommentContext value={contextValue}>
      {children}
    </CommentContext>
  );
}
