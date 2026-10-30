"use client";

import type { DashboardDraft } from "@/types/api";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/inline-icon";

const relativeTime = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

/** 将草稿时间转换为相对时间；没有时间时不显示。 */
const sinceText = (iso: string | undefined) => {
  if (!iso) return "";
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
};

interface EditorHeaderProps {
  title: string;
  invalid?: string;
  remoteDraft?: DashboardDraft;
  onTitleChange: (title: string) => void;
  onRestore: () => void;
  onDismiss: () => void;
}

/**
 * 标题与草稿恢复提示；标题自动增高，回车进入正文。
 * @param props 标题、校验信息及草稿操作
 * @returns 随正文滚动的编辑器头部
 */
export function EditorHeader({ title, invalid, remoteDraft, onTitleChange, onRestore, onDismiss }: EditorHeaderProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);
  return (
    <>
      {remoteDraft && (
        <Alert className="mb-6">
          <Icon icon="mingcute:history-line" aria-hidden="true" />
          <AlertTitle>有一份未发布的草稿</AlertTitle>
          <AlertDescription>
            <p>保存于{sinceText(remoteDraft.updated ?? remoteDraft.created)}，与当前已保存版本不同。</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-lg" onClick={onRestore}>恢复草稿</Button>
              <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={onDismiss}>丢弃</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <div className="mb-6 flex flex-col gap-1" data-field="title">
        <textarea
          ref={ref}
          rows={1}
          value={title}
          onChange={event => onTitleChange(event.target.value.replace(/\n/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.closest("[data-editor-root]")?.querySelector<HTMLElement>(".ns-prose, .cm-content")?.focus();
            }
          }}
          placeholder="无标题"
          aria-label="标题"
          aria-invalid={Boolean(invalid) || undefined}
          className="w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 lg:text-5xl"
        />
        {invalid && <p role="alert" className="text-sm text-destructive">{invalid}</p>}
      </div>
    </>
  );
}

/** 详情尚未载入时保留编辑器的布局轮廓。 */
export function EditorLoading() {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="h-12 border-b border-border/50" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pt-20 lg:px-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
