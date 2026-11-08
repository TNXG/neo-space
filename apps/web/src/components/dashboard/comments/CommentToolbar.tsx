"use client";

import type { Comment } from "@/types/api";
import type { DashboardCommentState } from "@/types/dashboard-comments";
import { ConfirmDeleteButton } from "@/components/dashboard/content/ConfirmDeleteButton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setDashboardCommentStates, toggleDashboardComment } from "@/lib/dashboard/comments";

export type RunCommentAction = (label: string, action: () => Promise<unknown>) => Promise<boolean>;

/** Owner-only actions always target the active tree node, not merely the original inbox card. */
export function CommentToolbar({ comment, pending, run, onDelete, onEdit }: {
  comment: Comment;
  pending: boolean;
  run: RunCommentAction;
  onDelete: () => Promise<unknown>;
  onEdit: () => void;
}) {
  return (
    <fieldset disabled={pending} className="flex min-w-0 flex-wrap items-center gap-1 border-b border-border px-4 py-2 disabled:opacity-60">
      <legend className="sr-only">管理 {comment.author} 的评论</legend>
      <Select value={String(comment.state)} onValueChange={(value) => { void run("状态已更新", () => setDashboardCommentStates([comment._id], Number(value) as DashboardCommentState)); }} disabled={pending}>
        <SelectTrigger size="sm" aria-label="评论状态" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="3">待审核</SelectItem>
            <SelectItem value="0">未读</SelectItem>
            <SelectItem value="1">已读 / 通过</SelectItem>
            <SelectItem value="2">垃圾桶</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button variant="ghost" size="sm" onClick={onEdit}>编辑</Button>
      <Button variant="ghost" size="sm" aria-pressed={comment.pin} onClick={() => { void run(comment.pin ? "已取消置顶" : "已置顶", () => toggleDashboardComment(comment._id, "pin", !comment.pin)); }}>{comment.pin ? "取消置顶" : "置顶"}</Button>
      <Button variant="ghost" size="sm" aria-pressed={comment.isWhispers} onClick={() => { void run(comment.isWhispers ? "已公开" : "已设为私密", () => toggleDashboardComment(comment._id, "hide", !comment.isWhispers)); }}>{comment.isWhispers ? "公开" : "私密"}</Button>
      <div className="ml-auto flex items-center" title="删除此评论及其所有子回复">
        <ConfirmDeleteButton key={comment._id} label={`${comment.author}的评论及所有回复`} onConfirm={onDelete} />
      </div>
    </fieldset>
  );
}
