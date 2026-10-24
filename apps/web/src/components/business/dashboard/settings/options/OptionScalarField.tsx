"use client";

import { useState } from "react";
import type { OptionDocument, OptionValue } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/inline-icon";
import type { OptionField } from "./option-schema";
import { isOptionDocument, sameOptionValue } from "./option-values";

interface ScalarFieldProps {
  field: OptionField;
  id: string;
  value: OptionValue | undefined;
  root: OptionDocument;
  disabled: boolean;
  onChange: (value: OptionValue | undefined) => void;
}

/** 配置行区分未配置、false 和空值；凭据始终使用密码输入。 */
export function OptionScalarField({ field, id, value, root, disabled, onChange }: ScalarFieldProps) {
  const [validation, setValidation] = useState({ value: "", message: "" });
  const [lineDraft, setLineDraft] = useState<{ source: OptionValue; text: string } | null>(null);
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const error = validation.value === text ? validation.message : "";
  const providers = Array.isArray(root.providers) ? root.providers.filter(isOptionDocument) : [];
  const choices = field.providerChoices
    ? providers.flatMap(provider => typeof provider.id === "string" ? [{ value: provider.id, label: typeof provider.name === "string" && provider.name ? provider.name : provider.id }] : [])
    : field.choices ?? [];
  const accessibility = {
    id, disabled, "aria-invalid": Boolean(error),
    "aria-describedby": `${id}-description`,
    "aria-errormessage": error ? `${id}-error` : undefined,
  };

  /** 清理旧校验消息，不持久化或记录配置值。 */
  function change(next: OptionValue | undefined) {
    setValidation({ value: "", message: "" });
    onChange(next);
  }

  /** 按声明字段选择现有 shadcn 控件，避免手写交互语义。 */
  function renderControl() {
    if (field.type === "boolean") {
      return <div className="flex min-h-9 items-center gap-2">
        <Checkbox {...accessibility} checked={typeof value === "boolean" ? value : "indeterminate"} onCheckedChange={checked => change(checked === true)} />
        <span className="text-sm text-muted-foreground">{value === undefined ? "未配置" : value ? "已开启" : "已关闭"}</span>
      </div>;
    }
    if (field.type === "select") {
      return <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button {...accessibility} type="button" variant="outline" className="w-full justify-between">
            <span className="truncate">{choices.find(choice => choice.value === text)?.label ?? (text || "未配置")}</span>
            <Icon icon="mingcute:down-line" data-icon="inline-end" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup value={text} onValueChange={next => change(next || undefined)}>
            <DropdownMenuRadioItem value="">未配置</DropdownMenuRadioItem>
            {choices.map((choice, index) => <DropdownMenuRadioItem key={`${choice.value}-${index}`} value={choice.value}>{choice.label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>;
    }
    if (field.type === "textarea") {
      return <Textarea {...accessibility} rows={3} required={field.required} value={text} onChange={event => change(event.target.value)} />;
    }
    if (field.type === "lines") {
      const lines = lineDraft && sameOptionValue(value, lineDraft.source)
        ? lineDraft.text : Array.isArray(value) ? value.filter(item => typeof item === "string").join("\n") : "";
      return <Textarea {...accessibility} rows={3} value={lines} onBlur={() => setLineDraft(null)} onChange={event => {
        const next = event.target.value.split("\n").map(item => item.trim()).filter(Boolean);
        setLineDraft({ source: next, text: event.target.value });
        change(next);
      }} />;
    }
    return <Input {...accessibility} type={field.type} value={text} required={field.required}
      min={field.min} max={field.max} step={field.step}
      autoComplete={field.type === "password" ? "new-password" : "off"} spellCheck={false}
      onInvalid={event => setValidation({ value: text, message: event.currentTarget.validationMessage })}
      onChange={event => change(field.type === "number"
        ? event.target.value === "" ? undefined : event.target.valueAsNumber
        : event.target.value)} />;
  }

  return (
    <Field data-disabled={disabled} data-invalid={Boolean(error)} className="gap-4 border-b border-border/40 px-4 py-4 last:border-b-0 lg:flex-row lg:items-start lg:gap-8">
      <FieldContent className="lg:w-1/3 lg:max-w-56 lg:shrink-0 lg:flex-none">
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        <FieldDescription id={`${id}-description`}>
          {field.description && <span className="block">{field.description}</span>}
          {field.environment && <span className="block break-words">环境变量优先：{field.environment}</span>}
          {value === undefined && <span className="block">未配置，当前使用后端默认行为。</span>}
          {field.type === "password" && <span className="block">清空输入并保存可清除数据库中的此凭据。</span>}
        </FieldDescription>
      </FieldContent>
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:w-auto">
        {renderControl()}
        {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      </div>
    </Field>
  );
}
