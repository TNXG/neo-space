"use client";

import type { Comment } from "@/types/api";
import type { RunCommentAction } from "./CommentToolbar";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { editDashboardComment, replyDashboardComment } from "@/lib/dashboard/comments";
import { getUAInfo } from "@/lib/utils/ua-parse";
import { commentReplyInput } from "./comment-model";

/** Keep drafts on failed writes; clear only after Rust confirms the reply or edit. */
export function CommentComposer({ comment, editing, pending, run, onEdited }: {
  comment: Comment;
  editing: boolean;
  pending: boolean;
  run: RunCommentAction;
  onEdited: () => void;
}) {
  const [text, setText] = useState(editing ? comment.text : "");
  const input = useRef<HTMLTextAreaElement>(null);

  /** Submit to the selected node's direct parent contract, including replies to nested replies. */
  const submit = async () => {
    if (!text.trim() || pending) return;
    const payload = commentReplyInput(comment, text);
    if (!payload) return;
    const saved = await run(editing ? "评论已更新" : "回复成功", async () => editing ? editDashboardComment(comment._id, text) : replyDashboardComment({ ...payload, ua: await getUAInfo() }));
    if (saved) {
      setText("");
      if (editing) onEdited();
      else input.current?.focus();
    }
  };

  return (
    <form className="shrink-0 space-y-2 border-t border-border bg-background px-4 py-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <label htmlFor="dashboard-comment-draft" className="truncate font-medium">{editing ? "编辑" : "回复"} @{comment.author}</label>
        {editing && <button type="button" onClick={onEdited} disabled={pending} className="cursor-pointer text-muted-foreground hover:text-foreground">取消编辑</button>}
      </div>
      <textarea ref={input} id="dashboard-comment-draft" value={text} onChange={event => setText(event.target.value)} disabled={pending} rows={3} placeholder="支持 Markdown，Ctrl / ⌘ + Enter 提交" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} className="max-h-40 min-h-20 w-full resize-y rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-[1.6] outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-60" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{editing ? "正在修改评论内容" : "以站长身份公开回复"}</p>
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>{pending ? "提交中…" : editing ? "保存更改" : "发送回复"}</Button>
      </div>
    </form>
  );
}
