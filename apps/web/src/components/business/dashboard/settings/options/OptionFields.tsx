"use client";

import type { OptionDocument, OptionValue } from "@/types/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Icon } from "@/lib/inline-icon";
import { OptionScalarField } from "./OptionScalarField";
import type { OptionField } from "./option-schema";
import { isOptionDocument, readOption, writeOption } from "./option-values";

interface OptionFieldsProps {
  fields: readonly OptionField[];
  document: OptionDocument;
  root: OptionDocument;
  prefix: string;
  disabled: boolean;
  onChange: (path: string, value: OptionValue | undefined) => void;
}

/** 以明确字段维护嵌套配置；服务商列表支持真正添加和删除，不退化为 JSON 编辑器。 */
export function OptionFields({ fields, document, root, prefix, disabled, onChange }: OptionFieldsProps) {
  return <FieldGroup className="gap-0 border-y border-border/60">
    {fields.map(field => field.type === "object-list"
      ? <OptionObjectList key={field.path} field={field} value={readOption(document, field.path)} root={root} prefix={`${prefix}-${field.path}`} disabled={disabled} onChange={value => onChange(field.path, value)} />
      : <OptionScalarField key={field.path} field={field} id={`${prefix}-${field.path}`} value={readOption(document, field.path)} root={root} disabled={disabled} onChange={value => onChange(field.path, value)} />)}
  </FieldGroup>;
}

interface ObjectListProps {
  field: OptionField;
  value: OptionValue | undefined;
  root: OptionDocument;
  prefix: string;
  disabled: boolean;
  onChange: (value: OptionValue[]) => void;
}

/** 复制既有条目后修改；未知属性和未修改的密钥保持原值。 */
function OptionObjectList({ field, value, root, prefix, disabled, onChange }: ObjectListProps) {
  const valid = value === undefined || Array.isArray(value) && value.every(isOptionDocument);
  const entries = Array.isArray(value) && valid ? value.filter(isOptionDocument) : [];
  const typeChoices = field.fields?.find(item => item.path === "type")?.choices;
  const availableType = typeChoices?.find(choice => !entries.some(entry => entry.type === choice.value));
  const exhausted = !field.fields?.some(item => item.path === "id") && typeChoices !== undefined && !availableType;
  /** 技术服务商 ID 在新建时生成；不是数据库实体的主键替代。 */
  function add() {
    const entry = structuredClone(field.initial ?? {});
    if (entry.id === "") entry.id = crypto.randomUUID();
    if (exhausted || disabled || !valid) return;
    if (!Object.hasOwn(entry, "id") && availableType) entry.type = availableType.value;
    onChange([...entries, entry]);
  }
  return <FieldSet disabled={disabled} className="gap-4 p-4">
    <FieldLegend className="mb-0 flex w-full items-center justify-between gap-3 text-sm font-medium"><span>{field.label}</span><Button type="button" variant="secondary" size="sm" disabled={disabled || !valid || exhausted} onClick={add}><Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />添加</Button></FieldLegend>
    {field.description && <FieldDescription>{field.description}</FieldDescription>}
    {!valid ? <Alert variant="destructive"><AlertDescription>现有列表格式不兼容，已保留原值且禁止覆盖。请检查后端配置。</AlertDescription></Alert> : entries.length === 0 ? <FieldDescription className="py-4">尚未配置{field.label}，可通过添加建立条目。</FieldDescription> : entries.map((entry, index) => <FieldSet key={index} className="gap-3 rounded-lg border border-border/60 p-3">
      <FieldLegend className="mb-0 flex w-full items-center justify-between gap-3 text-sm"><span className="truncate">{typeof entry.name === "string" && entry.name ? entry.name : `${field.label} ${index + 1}`}</span><Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={`移除${field.label} ${index + 1}`} onClick={() => onChange(entries.filter((_, itemIndex) => itemIndex !== index))}><Icon icon="mingcute:delete-line" aria-hidden="true" /></Button></FieldLegend>
      <OptionFields fields={field.fields ?? []} document={entry} root={root} prefix={`${prefix}-${index}`} disabled={disabled} onChange={(path, next) => onChange(entries.map((item, itemIndex) => itemIndex === index ? writeOption(item, path, next) : item))} />
    </FieldSet>)}
  </FieldSet>;
}
