"use client";

import type { ApiResponse, Comment, CommentListResponse } from "@/types/api";
import type { DashboardComment } from "@/types/dashboard-comments";
import type { RunCommentAction } from "./CommentToolbar";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { dashboardCommentThreadKey, deleteDashboardComment, getDashboardCommentThread } from "@/lib/dashboard/comments";
import { Icon } from "@/lib/icons/inline-icon";
import { Link } from "@/locales/navigation";
import { CommentComposer } from "./CommentComposer";
import { CommentThread } from "./CommentThread";
import { CommentToolbar } from "./CommentToolbar";
import { commentReplyInput, countThreadComments, findCommentThread, findThreadComment, safeCommentPath } from "./comment-model";

/** Fetch the full document once, then render only the selected card's complete conversation root. */
export function CommentDetail({ selected, pending, run, onClose }: {
  selected: DashboardComment;
  pending: boolean;
  run: RunCommentAction;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState(selected._id);
  const [editing, setEditing] = useState(false);
  const context = commentReplyInput(selected, "");
  const refType = context?.refType;
  const thread = useSWR<ApiResponse<CommentListResponse>>(refType ? dashboardCommentThreadKey(selected.ref, refType) : null, () => getDashboardCommentThread(selected.ref, refType!));
  const root = findCommentThread(thread.data?.data?.comments ?? [], selected);
  const active = root ? findThreadComment(root, activeId) ?? root : null;
  const path = safeCommentPath(selected.anchor?.path);

  useEffect(() => {
    if (!root) return;
    document.getElementById(`dashboard-comment-${activeId}`)?.scrollIntoView({ block: "nearest" });
  }, [activeId, root?._id]);

  /** Selecting another node keeps the whole tree visible and changes the reply/action target. */
  const selectNode = (comment: Comment) => {
    setActiveId(comment._id);
    setEditing(false);
  };

  /** Single deletion cascades through descendants; leave no stale actionable detail afterward. */
  const remove = async () => {
    if (active && await run("评论及其子回复已删除", () => deleteDashboardComment(active._id))) onClose();
  };

  return (
    <section aria-label="评论会话" className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="返回评论列表" className="lg:hidden"><Icon icon="mingcute:left-line" aria-hidden="true" /></Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">对话详情{root && <span className="ml-2 text-xs font-normal text-muted-foreground">{countThreadComments(root)} 条留言</span>}</h2>
          {path ? <Link href={`${path}${path.includes("?") ? "&" : "?"}comment=${encodeURIComponent(selected._id)}#comment-${encodeURIComponent(selected._id)}`} target="_blank" rel="noopener noreferrer" className="block cursor-pointer truncate text-xs text-muted-foreground hover:text-primary">{selected.anchor?.title || "查看所在页面"} ↗</Link> : <p className="text-xs text-muted-foreground">所属内容已移除或无法访问</p>}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="刷新对话" disabled={pending || thread.isValidating} onClick={() => { void thread.mutate(); }}><Icon icon="mingcute:refresh-2-line" aria-hidden="true" /></Button>
      </header>
      {active && !thread.error && <CommentToolbar comment={active} pending={pending} run={run} onDelete={remove} onEdit={() => setEditing(true)} />}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-5" aria-busy={thread.isLoading}>
        {!refType ? <p role="alert" className="p-6 text-sm text-muted-foreground">暂不支持查看该内容的评论对话。</p>
          : thread.error ? <div role="alert" className="space-y-3 p-6 text-sm"><p>对话加载失败：{thread.error instanceof Error ? thread.error.message : "请重试"}</p><Button variant="outline" size="sm" onClick={() => { void thread.mutate(); }}>重试</Button></div>
            : thread.isLoading ? <p role="status" className="p-6 text-sm text-muted-foreground">正在加载对话…</p>
              : root && active ? <CommentThread comment={root} selectedId={active._id} onSelect={selectNode} pending={pending} />
                : <p role="status" className="p-6 text-sm text-muted-foreground">该评论已删除或不可见，请刷新列表。</p>}
      </div>
      <details className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">访客信息</summary>
        <dl className="mt-2 grid gap-1 break-all sm:grid-cols-2"><div><dt className="inline text-muted-foreground/80">邮箱：</dt><dd className="inline">{selected.mail || "未填写"}</dd></div><div><dt className="inline text-muted-foreground/80">网站：</dt><dd className="inline">{selected.url || "未填写"}</dd></div><div><dt className="inline text-muted-foreground/80">IP：</dt><dd className="inline">{selected.ip || "未知"}</dd></div><div><dt className="inline text-muted-foreground/80">设备：</dt><dd className="inline">{selected.agent || "未知"}</dd></div></dl>
      </details>
      {active && !thread.error && <CommentComposer key={`${active._id}-${editing}`} comment={active} editing={editing} pending={pending} run={run} onEdited={() => setEditing(false)} />}
    </section>
  );
}
