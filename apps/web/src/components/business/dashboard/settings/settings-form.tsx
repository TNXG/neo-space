"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/inline-icon";
import { AiSettings } from "./ai-settings";
import { SettingsField } from "./settings-field";
import { focusSettingsField, SettingsIssueList, SettingsNotice, SettingsSaveBar } from "./settings-savebar";
import { SettingsSkeleton } from "./settings-skeleton";
import type { SettingGroup } from "./settings-schema";
import { type SettingsIssue } from "./settings-model";
import { validateSettings } from "./settings-validation";
import { useGroupSettings } from "./use-settings-draft";

/** 浮动操作条 + 紧凑分组；离开页面前保留草稿，保存只提交当前分组。 */
export function SettingsForm({ group }: { group: SettingGroup }) {
  const state = useGroupSettings(group);
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
    const found = validateSettings(group, state.document);
    setIssues(found);
    if (found.length) {
      setAttention(value => value + 1);
      requestAnimationFrame(() => focusSettingsField(form.current, found[0].path));
      return;
    }
    void state.save();
  }

  /** 只清除被修改字段的问题，其余提示继续保留，用户可逐项处理。 */
  function change(path: string, value: Parameters<typeof state.change>[1]) {
    setIssues(current => current.length ? current.filter(issue => issue.path !== path && !issue.path.startsWith(`${path}.`)) : current);
    state.change(path, value);
  }

  return (
    <form
      ref={form}
      aria-label={group.title}
      aria-busy={state.loading || state.pending}
      className="flex h-full min-h-0 min-w-0 flex-col"
      onKeyDown={event => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault();
      }}
      onSubmit={event => { event.preventDefault(); submit(); }}
      onReset={event => { event.preventDefault(); state.reset(); setIssues([]); }}
      data-settings-form
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pt-5 lg:px-6 lg:pt-8">
          <header className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/80" aria-hidden="true">
              <Icon icon={group.icon} className="size-[1.125rem]" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="truncate text-base font-semibold tracking-tight">{group.title}</h2>
              {group.help && <p className="text-[0.8125rem] text-foreground/70">{group.help}</p>}
            </div>
          </header>

          <SettingsNotice show={Boolean(state.failure)}>
            <Alert variant="destructive">
              <AlertTitle>{state.awaitingRead ? "已保存，等待确认生效值" : "配置请求失败"}</AlertTitle>
              <AlertDescription>
                <p>{state.failure}</p>
                <Button type="button" variant="outline" size="sm" disabled={state.pending} onClick={() => { void state.retry(); }}>
                  {state.awaitingRead ? "重新读取已保存配置" : "重试读取"}
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

          {state.document ? (
            group.key === "ai" ? (
              <AiSettings document={state.document} disabled={state.busy} issues={issues} onChange={change} />
            ) : (
              group.sections.map((section, index) => (
                <motion.section
                  key={section.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index, 5) * 0.04, ease: [0.23, 1, 0.32, 1] }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                      <Icon icon={section.icon} className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>{section.title}</span>
                    </h3>
                    {section.help && <p className="pl-6 text-[0.8125rem] text-foreground/70">{section.help}</p>}
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
                        onChange={change}
                      />
                    ))}
                  </div>
                </motion.section>
              ))
            )
          ) : (
            state.loading && <SettingsSkeleton group={group} />
          )}
        </div>
        <SettingsSaveBar dirty={dirty} pending={state.pending} disabled={state.busy} attention={attention} saveLabel="保存" />
      </div>
    </form>
  );
}
