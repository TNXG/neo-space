"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { AiSettings } from "./ai-settings";
import { CommentReviewLink } from "./comment-review-link";
import { OAuthSettings } from "./oauth-settings";
import { SettingsField } from "./settings-field";
import { focusSettingsField, SettingsIssueList, SettingsNotice, SettingsSaveBar } from "./settings-savebar";
import { SettingsSection } from "./settings-section";
import { SettingsSkeleton } from "./settings-skeleton";
import type { SettingGroup } from "./settings-schema";
import { sameValue, type SettingsIssue } from "./settings-model";
import { validateSettings } from "./settings-validation";
import { useGroupSettings, useSettingsDrafts } from "./use-settings-draft";

/** 浮动操作条 + 紧凑分组；离开页面前保留草稿，保存只提交当前分组。 */
export function SettingsForm({ group, embedded = false }: { group: SettingGroup; embedded?: boolean }) {
  const state = useGroupSettings(group);
  const drafts = useSettingsDrafts();
  const aiDirty = Boolean(drafts.ai && !sameValue(drafts.ai.base, drafts.ai.draft));
  const [issues, setIssues] = useState<SettingsIssue[]>([]);
  const [attention, setAttention] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const dirty = state.dirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** 保存前校验并定位第一个问题字段。 */
  function submit() {
    if (!state.document || state.busy || !state.dirty) return;
    const found = validateSettings(group, state.document, state.options);
    setIssues(found);
    if (found.length) {
      setAttention(value => value + 1);
      requestAnimationFrame(() => focusSettingsField(form.current, found[0].path));
      return;
    }
    void state.save();
  }

  /** 只清除被修改字段的问题，其余提示继续保留，用户可逐项处理。 */
  const change = (path: string, value: Parameters<typeof state.change>[1]) => {
    setIssues(current => current.length ? current.filter(issue => issue.path !== path && !issue.path.startsWith(`${path}.`)) : current);
    state.change(path, value);
  };

  return (
    <form
      ref={form}
      aria-label={group.title}
      aria-busy={state.loading || state.pending}
      className={cn("flex min-h-0 min-w-0 flex-col", !embedded && "h-full")}
      onKeyDown={event => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault();
      }}
      onSubmit={event => { event.preventDefault(); submit(); }}
      onReset={event => { event.preventDefault(); state.reset(); setIssues([]); }}
      data-settings-form
      data-dirty={state.dirty || undefined}
    >
      <div className={cn("relative flex min-h-0 flex-col", !embedded && "flex-1 overflow-y-auto overscroll-contain")}>
        <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-8", embedded ? "px-1" : "flex-1 px-4 pt-6 lg:px-6 lg:pt-10")}>
          <header className="flex items-start gap-3.5 px-1">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-foreground/80 shadow-xs" aria-hidden="true">
              <Icon icon={group.icon} className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="truncate text-lg font-semibold tracking-tight">{group.title}</h2>
              {group.help && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{group.help}</p>}
            </div>
          </header>

          <SettingsNotice show={Boolean(state.failure)}>
            <Alert variant="destructive">
              <AlertTitle>{state.awaitingRead ? "已保存，正在同步最新状态" : "读取或保存失败"}</AlertTitle>
              <AlertDescription>
                <p>{state.failure}</p>
                <Button type="button" variant="outline" size="sm" disabled={state.pending} onClick={() => { void state.retry(); }}>
                  {state.awaitingRead ? "重新加载最新设置" : "重试"}
                </Button>
              </AlertDescription>
            </Alert>
          </SettingsNotice>
          <SettingsNotice show={issues.length > 0}>
            <Alert variant="destructive">
              <AlertTitle>还有 {issues.length} 项需要处理</AlertTitle>
              <AlertDescription><SettingsIssueList issues={issues} onSelect={path => focusSettingsField(form.current, path)} /></AlertDescription>
            </Alert>
          </SettingsNotice>
          {(group.key === "commentOptions" || group.key === "ai") && state.document && (
            <CommentReviewLink
              from={group.key === "ai" ? "ai" : "comments"}
              comments={state.options?.commentOptions}
              ai={state.options?.ai}
              aiDirty={aiDirty}
            />
          )}

          {state.document ? (
            group.key === "ai" ? (
              <AiSettings document={state.document} disabled={state.busy} issues={issues} onChange={change} />
            ) : group.key === "oauth" ? (
              <OAuthSettings group={group} document={state.document} disabled={state.busy} issues={issues} onChange={change} />
            ) : (
              group.sections.map((section, index) => (
                <SettingsSection key={section.title} title={section.title} icon={section.icon} description={section.help} index={index}>
                  {section.fields.map(field => (
                    <SettingsField
                      key={field.path}
                      field={field}
                      document={state.document!}
                      root={state.document!}
                      relative={field.path}
                      path={field.path}
                      id={`setting-${group.key}-${field.path}`.replaceAll(".", "-")}
                      disabled={state.busy}
                      issues={issues}
                      onChange={change}
                    />
                  ))}
                </SettingsSection>
              ))
            )
          ) : (
            state.loading && <SettingsSkeleton group={group} />
          )}
        </div>
        {embedded ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border/60 py-5">
            <span role="status" className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
              {state.dirty && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
              {state.dirty ? "有未保存的修改" : "已保存最新设置"}
            </span>
            <Button type="reset" variant="ghost" size="sm" disabled={state.busy || !state.dirty}>放弃</Button>
            <Button type="submit" size="sm" disabled={state.busy || !state.dirty}>{state.pending ? "保存中…" : `保存${group.title}`}</Button>
          </div>
        ) : <SettingsSaveBar dirty={dirty} pending={state.pending} disabled={state.busy} attention={attention} saveLabel="保存" />}
      </div>
    </form>
  );
}
