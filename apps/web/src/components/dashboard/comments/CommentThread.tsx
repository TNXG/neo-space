"use client";

import type { Comment } from "@/types/api";
import { CommentMarkdown } from "@/components/common/markdown";
import { CommentHeader } from "@/components/comment/comment-item/CommentHeader";
import { cn } from "@/lib/utils";

interface CommentThreadProps {
  comment: Comment;
  selectedId: string;
  onSelect: (comment: Comment) => void;
  pending: boolean;
  depth?: number;
  parent?: Comment;
}

/** Render every descendant with the public comment header, Markdown and capped visual indentation. */
export function CommentThread({ comment, selectedId, onSelect, pending, depth = 0, parent }: CommentThreadProps) {
  const canNest = depth < 2;
  const selected = comment._id === selectedId;

  return (
    <div className={cn("relative", canNest && "before:absolute before:left-3.5 before:top-12 before:bottom-0 before:w-px before:bg-border") }>
      <article
        id={`dashboard-comment-${comment._id}`}
        aria-label={`${comment.author}的评论`}
        aria-current={selected ? "true" : undefined}
        className={cn("relative my-3 scroll-mt-4 rounded-lg border border-transparent px-2 py-3 transition-colors", selected && "border-primary/30 bg-primary/5")}
      >
        <dl><CommentHeader comment={comment} /></dl>
        <div className="ml-9 mt-2 sm:ml-11">
          {parent && <p className="mb-1.5 text-xs text-muted-foreground">回复 <button type="button" onClick={() => onSelect(parent)} disabled={pending} className="cursor-pointer font-medium text-foreground hover:text-primary focus-visible:outline-ring">@{parent.author}</button></p>}
          <div className="prose prose-sm max-w-none break-words text-foreground/90 leading-[1.6]">
            <CommentMarkdown content={comment.text} />
          </div>
          <button type="button" disabled={pending} onClick={() => onSelect(comment)} aria-pressed={selected} className="mt-2 cursor-pointer rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-ring disabled:opacity-50">
            {selected ? "正在回复此评论" : `回复 ${comment.author}`}
          </button>
        </div>
      </article>
      <div className={cn(canNest && "ml-5 sm:ml-7")}>
        {comment.children.map(child => <CommentThread key={child._id} comment={child} parent={comment} depth={canNest ? depth + 1 : depth} selectedId={selectedId} onSelect={onSelect} pending={pending} />)}
      </div>
    </div>
  );
}
