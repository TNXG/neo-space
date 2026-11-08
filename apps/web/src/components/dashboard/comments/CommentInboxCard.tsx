"use client";

import Image from "next/image";
import { SmartDate } from "@/components/common/smart-date/SmartDate";
import type { DashboardComment } from "@/types/dashboard-comments";

interface CommentInboxCardProps {
  comment: DashboardComment;
  checked: boolean;
  selected: boolean;
  pending: boolean;
  onCheck: (enabled: boolean) => void;
  onSelect: () => void;
}

/** Compact inbox row with independent selection and thread-opening controls. */
export function CommentInboxCard({ comment, checked, selected, pending, onCheck, onSelect }: CommentInboxCardProps) {
  const author = comment.author || "匿名访客";
  return (
    <li className={`flex items-start gap-2.5 border-b border-border/50 px-4 py-3 transition-colors ${selected ? "bg-secondary" : checked ? "bg-secondary/60" : "hover:bg-secondary/40"}`}>
      <input
        type="checkbox"
        aria-label={`选择 ${author} 的评论`}
        checked={checked}
        disabled={pending}
        onChange={(event) => onCheck(event.target.checked)}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed"
      />
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {comment.avatar ? (
          <Image src={comment.avatar} alt="" width={32} height={32} unoptimized className="mt-0.5 size-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">{Array.from(author)[0]}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{author}</span>
            {comment.parentCommentId && <span className="shrink-0 text-xs text-muted-foreground">回复</span>}
            <SmartDate date={comment.createdAt} showTooltip={false} className="ml-auto shrink-0 text-xs text-muted-foreground" />
          </span>
          <span className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{comment.isDeleted ? "该评论已删除" : comment.text}</span>
          {comment.isWhispers && <span className="mt-1 inline-flex rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">悄悄话</span>}
        </span>
      </button>
    </li>
  );
}
