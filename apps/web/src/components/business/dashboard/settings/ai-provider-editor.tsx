"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/inline-icon";
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
  };

  return (
    <FieldGroup className="gap-5 border-t border-border/60 bg-muted/30 px-4 py-5 lg:px-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field data-path={`${base}.name`}>
          <FieldLabel htmlFor={fieldId("name")}>显示名称</FieldLabel>
          <Input id={fieldId("name")} value={provider.name ?? ""} disabled={disabled} placeholder="例如 DeepSeek" onChange={event => onUpdate("name", event.target.value)} />
          <FieldDescription className="text-[0.8125rem]">仅在后台显示。</FieldDescription>
        </Field>
        <Field data-path={`${base}.defaultModel`}>
          <FieldLabel htmlFor={fieldId("defaultModel")}>默认模型</FieldLabel>
          <Input id={fieldId("defaultModel")} value={provider.defaultModel ?? ""} disabled={disabled} placeholder="例如 deepseek-chat" spellCheck={false} className="font-mono text-[0.8125rem]" onChange={event => onUpdate("defaultModel", event.target.value)} />
          <FieldDescription className="text-[0.8125rem]">功能未单独指定模型时使用。</FieldDescription>
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
          placeholder="https://api.example.com/v1"
          spellCheck={false}
          className="font-mono text-[0.8125rem]"
          onChange={event => onUpdate("endpoint", event.target.value)}
        />
        {errors.endpoint ? <FieldError>{errors.endpoint}</FieldError> : <FieldDescription className="text-[0.8125rem]">填写含 /v1 的基础地址，请求时自动追加 /chat/completions。</FieldDescription>}
      </Field>

      <Field data-path={`${base}.apiKey`}>
        <FieldLabel htmlFor={fieldId("apiKey")}>API 密钥</FieldLabel>
        <SecretInput id={fieldId("apiKey")} value={provider.apiKey ?? ""} disabled={disabled} placeholder="sk-…" onChange={value => onUpdate("apiKey", value)} />
        <FieldDescription className="text-[0.8125rem]">仅后端使用，以 Bearer 令牌发送；清空并保存即删除。</FieldDescription>
      </Field>

      <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <Field data-path={`${base}.id`} data-invalid={Boolean(errors.id) || undefined} className="sm:max-w-xs">
          <FieldLabel htmlFor={fieldId("id")} className="text-[0.8125rem] text-muted-foreground">技术标识</FieldLabel>
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
