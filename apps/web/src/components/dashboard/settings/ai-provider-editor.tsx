"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/lib/icons/inline-icon";
import type { AiProvider } from "./ai-model";
import { SecretInput } from "./settings-inputs";

interface AiProviderEditorProps {
  provider: AiProvider;
  index: number;
  disabled: boolean;
  errorFor: (path: string) => string | undefined;
  onUpdate: (key: keyof AiProvider, value: string) => void;
  onRemove: () => void;
}

/** 服务商连接信息：常用字段在前，技术标识与删除放在末尾，降低误操作。 */
export function AiProviderEditor({ provider, index, disabled, errorFor, onUpdate, onRemove }: AiProviderEditorProps) {
  const base = `providers.${index}`;
  const fieldId = (key: string) => `ai-provider-${index}-${key}`;
  const errors = {
    endpoint: errorFor(`${base}.endpoint`),
    id: errorFor(`${base}.id`),
    apiKey: errorFor(`${base}.apiKey`),
  };

  return (
    <FieldGroup className="gap-5 border-t border-border/60 bg-muted/30 px-4 py-5 lg:px-5">
      <Field data-path={`${base}.type`}>
        <FieldLabel htmlFor={fieldId("type")}>接口类型</FieldLabel>
        <Select value={provider.type || "openai-compatible"} disabled={disabled} onValueChange={value => onUpdate("type", value)}>
          <SelectTrigger id={fieldId("type")} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="openai-compatible">OpenAI 兼容</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="jev">Jev 反垃圾</SelectItem>
          </SelectGroup></SelectContent>
        </Select>
        <FieldDescription>常规大模型请选择「OpenAI 兼容」；Jev 仅用于评论反垃圾。</FieldDescription>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field data-path={`${base}.name`}>
          <FieldLabel htmlFor={fieldId("name")}>显示名称</FieldLabel>
          <Input id={fieldId("name")} value={provider.name ?? ""} disabled={disabled} placeholder="例如 DeepSeek" onChange={event => onUpdate("name", event.target.value)} />
          <FieldDescription className="text-[0.8125rem]">方便你在列表中区分不同服务商。</FieldDescription>
        </Field>
        <Field data-path={`${base}.defaultModel`}>
          <FieldLabel htmlFor={fieldId("defaultModel")}>默认模型</FieldLabel>
          <Input id={fieldId("defaultModel")} value={provider.defaultModel ?? ""} disabled={disabled} placeholder={provider.type === "jev" ? "jev-latest" : "例如 deepseek-chat"} spellCheck={false} className="font-mono text-[0.8125rem]" onChange={event => onUpdate("defaultModel", event.target.value)} />
          <FieldDescription className="text-[0.8125rem]">具体功能未单独填写模型时默认使用。</FieldDescription>
        </Field>
      </div>

      <Field data-path={`${base}.endpoint`} data-invalid={Boolean(errors.endpoint) || undefined}>
        <FieldLabel htmlFor={fieldId("endpoint")}>接口地址</FieldLabel>
        <Input
          id={fieldId("endpoint")}
          type="url"
          inputMode="url"
          value={provider.endpoint ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errors.endpoint)}
          placeholder={provider.type === "jev" ? "https://api.typesafe.ai/v1" : "https://api.example.com/v1"}
          spellCheck={false}
          className="font-mono text-[0.8125rem]"
          onChange={event => onUpdate("endpoint", event.target.value)}
        />
        {errors.endpoint ? <FieldError>{errors.endpoint}</FieldError> : <FieldDescription className="text-[0.8125rem]">{provider.type === "jev" ? "默认使用 https://api.typesafe.ai/v1。" : "填写包含 /v1 的接口地址，例如 https://api.deepseek.com/v1。"}</FieldDescription>}
      </Field>

      <Field data-path={`${base}.apiKey`} data-invalid={Boolean(errors.apiKey) || undefined}>
        <FieldLabel htmlFor={fieldId("apiKey")}>API 密钥</FieldLabel>
        <SecretInput id={fieldId("apiKey")} value={provider.apiKey ?? ""} disabled={disabled} invalid={Boolean(errors.apiKey)} placeholder="sk-…" onChange={value => onUpdate("apiKey", value)} />
        <FieldDescription className="text-[0.8125rem]">服务商提供的接口密钥；清空后保存即可移除。</FieldDescription>
        {errors.apiKey && <FieldError>{errors.apiKey}</FieldError>}
      </Field>

      <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <Field data-path={`${base}.id`} data-invalid={Boolean(errors.id) || undefined} className="sm:max-w-xs">
          <FieldLabel htmlFor={fieldId("id")} className="text-[0.8125rem] text-muted-foreground">服务商标识</FieldLabel>
          <Input id={fieldId("id")} value={provider.id} disabled={disabled} aria-invalid={Boolean(errors.id)} spellCheck={false} className="h-8 font-mono text-xs" onChange={event => onUpdate("id", event.target.value)} />
          {errors.id && <FieldError>{errors.id}</FieldError>}
        </Field>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto" onClick={onRemove}>
          <Icon icon="mingcute:delete-2-line" data-icon="inline-start" aria-hidden="true" />
          移除服务商
        </Button>
      </div>
    </FieldGroup>
  );
}
