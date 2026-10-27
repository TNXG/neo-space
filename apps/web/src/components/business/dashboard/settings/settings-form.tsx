"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/inline-icon";
import { AiSettings } from "./ai-settings";
import { SettingsField } from "./settings-field";
import { SettingsSkeleton } from "./settings-skeleton";
import type { SettingGroup } from "./settings-schema";
import { type SettingsIssue } from "./settings-model";
import { validateSettings } from "./settings-validation";
import { useGroupSettings } from "./use-settings-draft";

/** 固定操作栏 + 紧凑分组；离开页面前保留草稿，保存只提交当前分组。 */
export function SettingsForm({ group }: { group: SettingGroup }) {
  const state = useGroupSettings(group);
  const [issues, setIssues] = useState<SettingsIssue[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const dirty = state.dirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** 集合条目需要先展开再渲染输入，逐帧重试直到问题字段出现。 */
  function focusIssue(path: string, attempt = 0) {
    const target = form.current?.querySelector<HTMLElement>(`[data-path="${path}"]`);
    if (!target) {
      if (attempt < 10) requestAnimationFrame(() => focusIssue(path, attempt + 1));
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.querySelector<HTMLElement>("input, select, textarea, [role=switch], [role=combobox]")?.focus({ preventScroll: true });
  }

  /** 保存前校验并定位第一个问题字段。 */
  function submit() {
    if (!state.document || state.busy || !state.dirty) return;
    const found = validateSettings(group, state.document);
    setIssues(found);
    if (found.length) {
      requestAnimationFrame(() => focusIssue(found[0].path));
      return;
    }
    void state.save();
  }

  return (
    <form
      ref={form}
      aria-label={group.title}
      aria-busy={state.loading || state.pending}
      className="flex h-full min-h-0 min-w-0 flex-col"
      onKeyDown={event => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          submit();
        }
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault();
      }}
      onSubmit={event => { event.preventDefault(); submit(); }}
      onReset={event => { event.preventDefault(); state.reset(); setIssues([]); }}
    >
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 lg:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight">{group.title}</h1>
            {dirty && <span role="status" className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground font-medium">未保存</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Button type="reset" variant="ghost" size="sm" disabled={state.busy}>撤销修改</Button>}
          {state.loading ? <Skeleton aria-hidden="true" className="h-8 w-24 rounded-lg" /> : <Button type="submit" size="sm" disabled={!dirty || state.busy}>
            {state.pending
              ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
              : <Icon icon="mingcute:check-line" data-icon="inline-start" aria-hidden="true" />}
            {state.pending ? "保存中…" : "保存本组"}
          </Button>}
        </div>
        </header>

        <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 lg:p-6">
          {state.failure && (
            <Alert variant="destructive">
              <AlertTitle>{state.awaitingRead ? "已保存，等待确认生效值" : "配置请求失败"}</AlertTitle>
              <AlertDescription>
                <p>{state.failure}</p>
                <Button type="button" variant="outline" size="sm" disabled={state.pending} onClick={() => { void state.retry(); }}>
                  {state.awaitingRead ? "重新读取已保存配置" : "重试读取"}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {issues.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>还有 {issues.length} 项需要处理</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {issues.slice(0, 4).map((issue, index) => <li key={`${issue.path}-${index}`}>{issue.message}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {state.message && <Alert role="status"><AlertTitle>保存完成</AlertTitle><AlertDescription>{state.message}</AlertDescription></Alert>}

          {state.document ? (
            group.key === "ai" ? (
              <AiSettings
                document={state.document}
                disabled={state.busy}
                issues={issues}
                onChange={(path, value) => {
                  setIssues([]);
                  state.change(path, value);
                }}
              />
            ) : (
              group.sections.map(section => (
                <section key={section.title} className="flex flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                      <Icon icon={section.icon} className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>{section.title}</span>
                    </h2>
                    {section.help && <p className="pl-6 text-[13px] text-foreground/70">{section.help}</p>}
                  </div>
                  <div className="divide-y divide-border/50 rounded-xl border border-border px-3 lg:px-4">
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
                        onChange={(path, value) => { setIssues([]); state.change(path, value); }}
                      />
                    ))}
                  </div>
                </section>
              ))
            )
          ) : (
            state.loading && <SettingsSkeleton group={group} />
          )}
        </div>
      </div>
    </form>
  );
}
