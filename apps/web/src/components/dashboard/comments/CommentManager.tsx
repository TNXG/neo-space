"use client";

import type { DashboardComment, DashboardCommentState } from "@/types/dashboard-comments";
import { useState } from "react";
import { ConfirmDeleteButton } from "@/components/dashboard/content/ConfirmDeleteButton";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useDashboardComments } from "@/hooks/use-dashboard-comments";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { deleteAllDashboardComments, setAllDashboardCommentStates } from "@/lib/dashboard/comment-bulk";
import { deleteDashboardComments, setDashboardCommentStates } from "@/lib/dashboard/comments";
import { Icon } from "@/lib/icons/inline-icon";
import { cn } from "@/lib/utils";
import { CommentDetail } from "./CommentDetail";
import { CommentInbox } from "./CommentInbox";

/** Inbox/master-detail management backed exclusively by the authenticated browser comment cache. */
export function CommentManager() {
  const comments = useDashboardComments();
  const mobile = useIsMobile(1024);
  const [snapshot, setSnapshot] = useState<DashboardComment | null>(null);
  const [allSelected, setAllSelected] = useState(false);
  const selected = comments.selected ?? snapshot;
  const pagination = comments.list.data?.data?.pagination;
  const selectedCount = allSelected ? pagination?.total ?? 0 : comments.checked.length;
  const pending = comments.pending !== null;

  /** Snapshot keeps a conversation open after its card moves to another moderation bucket. */
  const select = (comment: DashboardComment) => {
    comments.select(comment._id);
    setSnapshot(comment);
  };

  /** Filter and page changes must discard hidden bulk targets and the old detail. */
  const resetSelection = () => {
    setAllSelected(false);
    setSnapshot(null);
  };

  /** Both explicit-ID and whole-filter writes share the hook's lock, feedback and cache refresh. */
  const changeStates = async (state: DashboardCommentState) => {
    if (!selectedCount) return;
    const saved = await comments.run("评论状态已更新", () => allSelected ? setAllDashboardCommentStates(comments.state, state) : setDashboardCommentStates(comments.checked, state));
    if (saved) setAllSelected(false);
  };

  /** Bulk deletion does not cascade across unselected comments, unlike node deletion in the tree. */
  const removeSelected = async () => {
    if (!selectedCount) return;
    const saved = await comments.run("选中的评论已删除", () => allSelected ? deleteAllDashboardComments(comments.state) : deleteDashboardComments(comments.checked));
    if (saved) {
      resetSelection();
      comments.select(null);
    }
  };

  const inbox = (
    <CommentInbox items={comments.items} state={comments.state} selectedId={selected?._id ?? null} checked={comments.checked} page={comments.page} pagination={pagination} loading={comments.list.isLoading} error={comments.list.error instanceof Error ? comments.list.error.message : comments.list.error ? "评论加载失败" : undefined} pending={pending} allSelected={allSelected}
      onStateChange={state => { resetSelection(); comments.changeState(state); }} onSelect={select}
      onCheck={(_id, checked) => { setAllSelected(false); comments.check(_id, checked); }} onCheckPage={checked => { setAllSelected(false); comments.checkPage(checked); }}
      onPageChange={page => { resetSelection(); comments.changePage(page); }} onRetry={() => { void comments.list.mutate(); }} onSelectAll={() => setAllSelected(true)} />
  );
  const detail = selected
    ? <CommentDetail key={selected._id} selected={selected} pending={pending} run={comments.run} onClose={() => { setSnapshot(null); comments.select(null); }} />
    : <section className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground"><Icon icon="mingcute:chat-3-line" className="size-10 opacity-40" aria-hidden="true" /><h2 className="text-sm font-medium text-foreground">选择一条评论</h2><p className="max-w-xs text-xs leading-[1.6]">点击左侧列表中的评论，即可查看完整对话并直接回复。</p></section>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="mr-auto"><h2 className="text-sm font-semibold">评论</h2><p className="text-xs text-muted-foreground">{selectedCount ? `已选 ${selectedCount} 条${allSelected ? "（当前筛选全部页）" : ""}` : "查看、审核与回复读者留言"}</p></div>
        <fieldset disabled={pending || !selectedCount} className="flex flex-wrap items-center gap-1 disabled:opacity-50">
          <legend className="sr-only">批量操作选中的评论</legend>
          {comments.state !== 1 && <Button variant="ghost" size="sm" onClick={() => { void changeStates(1); }}><Icon icon="mingcute:check-line" aria-hidden="true" />通过 / 已读</Button>}
          {comments.state !== 3 && <Button variant="ghost" size="sm" onClick={() => { void changeStates(3); }}>设为待审</Button>}
          {comments.state !== 2 && <Button variant="ghost" size="sm" onClick={() => { void changeStates(2); }}>移入垃圾桶</Button>}
          <ConfirmDeleteButton key={`${comments.state}-${comments.checked.join(",")}-${allSelected}`} label={`选中的 ${selectedCount} 条评论`} onConfirm={removeSelected} />
        </fieldset>
        <Button variant="ghost" size="icon-sm" aria-label="刷新评论列表" disabled={pending || comments.list.isValidating} onClick={() => { void comments.list.mutate(); }}><Icon icon="mingcute:refresh-2-line" aria-hidden="true" /></Button>
      </header>
      {comments.actionError && <p role="alert" className="shrink-0 border-b border-border bg-destructive/5 px-4 py-2 text-sm text-destructive">{comments.actionError}</p>}
      {pending && <p role="status" className="sr-only">{comments.pending}</p>}
      {mobile
        ? (
            <div className="grid min-h-0 flex-1">
              <div className={cn("min-h-0", selected && "hidden")}>{inbox}</div>
              <div className={cn("min-h-0", !selected && "hidden")}>{detail}</div>
            </div>
          )
        : (
            <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
              <ResizablePanel defaultSize="35%" minSize="22%" maxSize="55%" className="min-w-0">{inbox}</ResizablePanel>
              <ResizableHandle withHandle aria-label="调整评论列表与详情的宽度" />
              <ResizablePanel defaultSize="65%" minSize="30%" className="min-w-0">{detail}</ResizablePanel>
            </ResizablePanelGroup>
          )}
    </div>
  );
}
