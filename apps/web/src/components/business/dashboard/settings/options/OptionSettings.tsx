"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/inline-icon";
import { OptionFields } from "./OptionFields";
import { OptionSettingsSkeleton } from "./OptionSettingsSkeleton";
import type { OptionGroup } from "./option-schema";
import { validateOptionGroup } from "./option-validation";
import { useOptionSettings } from "./useOptionSettings";

/** 参考后台的紧凑分组表单；导航只存在于工作区侧栏。 */
export function OptionSettings({ group }: { group: OptionGroup }) {
  const state = useOptionSettings(group);
  const [validation, setValidation] = useState("");
  const disabled = state.pending || state.awaitingRead;
  return (
    <form aria-label={group.title} aria-busy={state.loading || state.pending} className="flex h-full min-h-0 min-w-0 flex-col" onSubmit={event => {
      event.preventDefault();
      const error = state.document ? validateOptionGroup(group, state.document) : undefined;
      setValidation(error ?? "");
      if (!error) void state.save();
    }} onReset={event => { event.preventDefault(); state.reset(); setValidation(""); }}>
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Icon icon={group.icon} className="size-4" aria-hidden="true" />{group.title}</h2>
        <div className="flex items-center gap-2">
          {state.canReset && <Button type="reset" variant="ghost" size="sm" disabled={disabled}>取消</Button>}
          {state.loading ? <Skeleton aria-hidden="true" className="h-8 w-20 rounded-xl" /> : <Button type="submit" size="sm" disabled={!state.dirty || disabled}><Icon icon="mingcute:check-line" data-icon="inline-start" aria-hidden="true" />{state.pending ? "保存中…" : "保存"}</Button>}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <FieldGroup className="mx-auto max-w-3xl gap-8 p-5 lg:p-6">
          {state.failure && <Alert variant="destructive"><AlertTitle>{state.awaitingRead ? "已保存，等待确认生效值" : "配置请求失败"}</AlertTitle><AlertDescription><p>{state.failure}</p><Button type="button" variant="outline" size="sm" disabled={state.pending} onClick={() => { void state.retry(); }}>{state.awaitingRead ? "重新读取已保存配置" : "重试读取"}</Button></AlertDescription></Alert>}
          {validation && <Alert variant="destructive"><AlertTitle>请检查配置</AlertTitle><AlertDescription>{validation}</AlertDescription></Alert>}
          {state.message && <Alert role="status"><AlertTitle>保存完成</AlertTitle><AlertDescription>{state.message}</AlertDescription></Alert>}
          {state.document ? <>
            <FieldDescription>{group.description}</FieldDescription>
            {group.sections.map(section => <FieldSet key={section.title} disabled={disabled}>
              <FieldLegend className="mb-0 flex items-center gap-3 text-sm font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Icon icon={section.icon} aria-hidden="true" /></span>{section.title}</FieldLegend>
              {section.description && <FieldDescription>{section.description}</FieldDescription>}
              <OptionFields fields={section.fields} document={state.document!} root={state.document!} prefix={`option-${group.key}`} disabled={disabled} onChange={(path, value) => { setValidation(""); state.change(path, value); }} />
            </FieldSet>)}
            {state.dirty && <p role="status" className="text-xs text-muted-foreground">有尚未保存的修改</p>}
          </> : state.loading && <OptionSettingsSkeleton group={group} />}
        </FieldGroup>
      </div>
    </form>
  );
}
