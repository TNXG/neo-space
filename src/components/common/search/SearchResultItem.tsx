"use client";

import type { SearchItem } from "./types";

import type { SearchNoteResult, SearchPostResult } from "@/types/api";

import { Icon } from "@iconify/react/offline";
import { formatDate, sanitizeHighlight } from "./utils";

interface SearchResultItemProps {
  item: SearchItem;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export function SearchResultItem({
  item,
  index,
  isSelected,
  onClick,
  onMouseEnter,
}: SearchResultItemProps) {
  const isPost = item.type === "post";
  const post = isPost ? (item.data as SearchPostResult) : null;
  const note = !isPost ? (item.data as SearchNoteResult) : null;
  const title = item.data.title;
  const highlightedTitle = item.data.highlighted_title;
  const contentHighlight = item.data.content_highlight;
  const created = item.data.created;

  return (
    <button
      data-index={index}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 transition-colors cursor-pointer ${
        isSelected
          ? "bg-accent/10 text-foreground"
          : "text-foreground/80 hover:bg-accent/5"
      }`}
    >
      {/* 类型图标 */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mt-0.5">
        <Icon
          icon={isPost ? "mingcute:document-2-line" : "mingcute:edit-3-line"}
          className="text-base text-accent-foreground"
        />
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-w-0">
        {/* 标题（带高亮） */}
        {highlightedTitle
          ? (
              <div
                className="text-sm font-medium truncate"
                /* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml -- sanitizeHighlight 已转义所有 HTML，仅保留 <mark> 标签 */
                dangerouslySetInnerHTML={{ __html: sanitizeHighlight(highlightedTitle) }}
              />
            )
          : (
              <div className="text-sm font-medium truncate">{title}</div>
            )}

        {/* 正文节选（带高亮） */}
        {contentHighlight && (
          <div
            className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed"
            /* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml -- sanitizeHighlight 已转义所有 HTML，仅保留 <mark> 标签 */
            dangerouslySetInnerHTML={{ __html: sanitizeHighlight(contentHighlight) }}
          />
        )}

        {/* 元信息 */}
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground/60">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
            isPost
              ? "bg-accent/8 text-accent-foreground/70"
              : "bg-teal-500/8 text-teal-600/70"
          }`}
          >
            {isPost ? "文章" : "笔记"}
          </span>
          {post?.category && (
            <span className="text-muted-foreground/80">{post.category.name}</span>
          )}
          {note && (
            <span className="text-muted-foreground/80">
              #
              {note.nid}
            </span>
          )}
          <span>{formatDate(created)}</span>
        </div>
      </div>

      <Icon icon="mingcute:arrow-right-up-line" className="text-muted-foreground/40 text-sm shrink-0 mt-1" />
    </button>
  );
}
