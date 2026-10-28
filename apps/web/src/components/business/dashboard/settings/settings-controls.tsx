"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SecretInput } from "./settings-inputs";

interface BaseControlProps {
  id: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** 开关为标准布尔切换控件，无冗余状态文案。 */
export function SettingsSwitch({ id, value, onChange, disabled, describedBy }: BaseControlProps & {
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch
      id={id}
      aria-describedby={describedBy}
      checked={value === true}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  );
}

/** 文本类字段共用受控输入；凭据交给 SecretInput 处理遮挡。 */
export function SettingsText({ id, type, value, onChange, disabled, invalid, describedBy, placeholder, multiline }: BaseControlProps & {
  type: "text" | "url" | "email" | "password" | "textarea";
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  if (multiline || type === "textarea") {
    return <Textarea id={id} aria-invalid={invalid} aria-describedby={describedBy} value={value} disabled={disabled} placeholder={placeholder} rows={3} onChange={event => onChange(event.target.value)} />;
  }
  if (type === "password") {
    return <SecretInput id={id} value={value} disabled={disabled} invalid={invalid} describedBy={describedBy} placeholder={placeholder} onChange={onChange} />;
  }
  return (
    <Input
      id={id}
      type={type}
      inputMode={type === "url" ? "url" : type === "email" ? "email" : undefined}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={type === "text"}
      className={type === "url" || type === "email" ? "font-mono text-[0.8125rem]" : undefined}
      onChange={event => onChange(event.target.value)}
    />
  );
}

/** 数字字段使用短输入并在单位紧邻位置显示，避免横跨整行。 */
export function SettingsNumber({ id, value, onChange, disabled, invalid, describedBy, min, max, step, unit, placeholder }: BaseControlProps & {
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => setText(value === undefined ? "" : String(value)), [value]);
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        className="w-28 tabular-nums"
        onChange={event => {
          const next = event.target.value;
          setText(next);
          if (next === "") onChange(undefined);
          else if (!Number.isNaN(event.target.valueAsNumber)) onChange(event.target.valueAsNumber);
        }}
        onBlur={() => setText(value === undefined ? "" : String(value))}
      />
      {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
    </div>
  );
}

/** 选项由声明提供；空选项表示删除覆盖值，回到后端默认。 */
export function SettingsChoice({ id, value, options, onChange, disabled, invalid, describedBy }: BaseControlProps & {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}) {
  const stale = Boolean(value) && !options.some(option => option.value === value);
  const label = value
    ? options.find(option => option.value === value)?.label ?? (stale ? `当前值已失效：${value}` : value)
    : "使用默认（不覆盖）";
  return (
    <Select
      value={value || "__unset__"}
      disabled={disabled}
      onValueChange={next => onChange(next === "__unset__" ? undefined : next)}
    >
      <SelectTrigger id={id} aria-invalid={invalid} aria-describedby={describedBy} className="w-full">
        <span className="truncate">{label}</span>
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          <SelectItem value="__unset__">使用默认（不覆盖）</SelectItem>
          {stale && <SelectItem value={value}>当前值已失效：{value}</SelectItem>}
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
