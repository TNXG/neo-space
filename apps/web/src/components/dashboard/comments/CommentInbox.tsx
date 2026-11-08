"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pagination } from "@/types/api";
import type { DashboardComment, DashboardCommentState } from "@/types/dashboard-comments";
import { CommentInboxCard } from "./CommentInboxCard";

export interface CommentInboxProps {
  items: DashboardComment[];
  state: DashboardCommentState;
  selectedId: string | null;
  checked: string[];
  page: number;
  pagination?: Pagination;
  loading: boolean;
  error?: string;
  pending: boolean;
  onStateChange: (state: DashboardCommentState) => void;
  onSelect: (comment: DashboardComment) => void;
  onCheck: (id: string, enabled: boolean) => void;
  onCheckPage: (enabled: boolean) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  allSelected: boolean;
  onSelectAll: () => void;
}

const filters = [
  { value: 3, label: "待审核" },
  { value: 0, label: "未读" },
  { value: 1, label: "已读" },
  { value: 2, label: "垃圾桶" },
] as const;

/** Controlled master list; fetching, mutations and cross-page collection belong to its owner. */
export function CommentInbox({
  items, state, selectedId, checked, page, pagination, loading, error, pending,
  onStateChange, onSelect, onCheck, onCheckPage, onPageChange, onRetry, allSelected, onSelectAll,
}: CommentInboxProps) {
  const checkbox = useRef<HTMLInputElement>(null);
  const checkedIds = new Set(checked);
  const pageChecked = items.filter((item) => checkedIds.has(item._id)).length;
  const everyChecked = items.length > 0 && pageChecked === items.length;
  const total = pagination?.total ?? items.length;
  const pages = pagination?.total_page ?? 1;
  const disabled = pending || loading;

  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = pageChecked > 0 && !everyChecked;
  }, [pageChecked, everyChecked]);

  return (
    <section aria-label="评论收件箱" aria-busy={loading} className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <Select value={String(state)} onValueChange={(value) => onStateChange(Number(value) as DashboardCommentState)} disabled={disabled}>
          <SelectTrigger size="sm" aria-label="筛选评论状态" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {filters.map((filter) => <SelectItem key={filter.value} value={String(filter.value)}>{filter.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="shrink-0 text-xs text-muted-foreground">{total} 条</span>
      </header>

      {items.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-4 py-2">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
            <input
              ref={checkbox}
              type="checkbox"
              aria-label="选择本页所有评论"
              checked={everyChecked}
              disabled={disabled}
              onChange={(event) => onCheckPage(event.target.checked)}
              className="size-4 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed"
            />
            <span aria-live="polite">{allSelected ? `已选全部 ${total} 条` : checked.length ? `已选 ${checked.length} 项` : "全选"}</span>
          </label>
          {everyChecked && pages > 1 && !allSelected && (
            <button type="button" disabled={disabled} onClick={onSelectAll} className="cursor-pointer rounded-sm text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
              选择全部 {total} 条
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div role="status" className="flex min-h-48 items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
            正在加载评论…
          </div>
        ) : error ? (
          <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="secondary" size="sm" onClick={onRetry} disabled={pending}>重试</Button>
          </div>
        ) : items.length === 0 ? (
          <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
            <p className="text-sm">暂无评论</p>
          </div>
        ) : (
          <ul>
            {items.map((comment) => (
              <CommentInboxCard key={comment._id} comment={comment} checked={checkedIds.has(comment._id)} selected={selectedId === comment._id} pending={pending} onCheck={(enabled) => onCheck(comment._id, enabled)} onSelect={() => onSelect(comment)} />
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="评论分页" className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/40 px-4 py-3">
          <Button type="button" variant="secondary" size="sm" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>上一页</Button>
          <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">{page} / {pages}</span>
          <Button type="button" variant="secondary" size="sm" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>下一页</Button>
        </nav>
      )}
    </section>
  );
}
