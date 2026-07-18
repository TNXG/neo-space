"use client";

import type { Comment } from "@/types/api";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useComments } from "@/hooks/use-comments";
import { CommentProvider } from "./CommentContext";
import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";
import { useCommentHighlight, useCommentRefresh } from "./hooks";

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
  const t = useTranslations();
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const searchParams = useSearchParams();
  // 邮件深链消费守卫：同一 comment 参数只触发一次，避免评论区刷新后重复展开
  const consumedDeepLinkRef = useRef<string | null>(null);

  // 将初始数据传递给 SWR，避免 hydration 不匹配
  const initialData = initialComments.length > 0
    ? { comments: initialComments, count: initialCount }
    : undefined;

  const { comments, refresh } = useComments(refId, refType, initialData);
  const { setRefreshComments } = useCommentRefresh();
  const { triggerReplyTarget } = useCommentHighlight();

  // 注册 refresh 函数到 Context
  useEffect(() => {
    setRefreshComments(refresh);
  }, [refresh, setRefreshComments]);

  // 邮件深链：读取 ?comment=<父级id>，等待评论树渲染后触发回复闭环——
  // 定位到「直接父级评论」、高亮并在其下方展开回复输入框。
  const deepLinkCommentId = searchParams.get("comment");
  useEffect(() => {
    if (!deepLinkCommentId || consumedDeepLinkRef.current === deepLinkCommentId) {
      return;
    }
    // 评论树至少有一条数据时才尝试定位，避免空树找不到目标元素
    if (comments.length === 0) {
      return;
    }
    consumedDeepLinkRef.current = deepLinkCommentId;
    // requestAnimationFrame 等待 DOM 落定后再滚动 + 展开
    const raf = requestAnimationFrame(() => {
      triggerReplyTarget(deepLinkCommentId);
    });
    return () => cancelAnimationFrame(raf);
  }, [deepLinkCommentId, comments.length, triggerReplyTarget]);

  const displayComments = comments.length > 0 ? comments : initialComments;

  const sortedComments = displayComments.toSorted((a, b) => {
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
            {t("comment.sortNewest")}
          </button>
          <button
            type="button"
            onClick={() => setSortBy("oldest")}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all cursor-pointer ${
              sortBy === "oldest" ? "bg-background text-primary-900 shadow-xs" : "text-primary-500 hover:text-primary-900"
            }`}
          >
            {t("comment.sortOldest")}
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
