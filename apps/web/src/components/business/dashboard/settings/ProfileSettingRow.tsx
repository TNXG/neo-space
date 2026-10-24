"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface ProfileSettingRowProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: ComponentProps<"input">["type"];
  autoComplete?: string;
  multiline?: boolean;
  preview?: ReactNode;
  disabled?: boolean;
  required?: boolean;
}

/** 参考后台设置行：桌面标签一栏，移动端上下排列。 */
export function ProfileSettingRow({
  id, label, description, value, onChange, type = "text", autoComplete,
  multiline = false, preview, disabled, required = false,
}: ProfileSettingRowProps) {
  const [validation, setValidation] = useState({ value: "", message: "" });
  const invalid = validation.value === value ? validation.message : "";
  const accessibility = {
    id,
    value,
    disabled,
    "aria-describedby": description ? `${id}-description` : undefined,
    "aria-invalid": Boolean(invalid),
    "aria-errormessage": invalid ? `${id}-error` : undefined,
  };

  return (
    <Field orientation="vertical" data-disabled={disabled} data-invalid={Boolean(invalid)} className="flex flex-col gap-4 border-b border-border/40 px-4 py-4 last:border-b-0 lg:flex-row lg:items-start lg:gap-8">
      <FieldContent className="lg:w-1/3 lg:max-w-56 lg:shrink-0 lg:flex-none">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
      </FieldContent>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-3">
          {preview}
          {multiline ? (
            <textarea
              {...accessibility}
              rows={3}
              className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(event) => { setValidation({ value: "", message: "" }); onChange(event.target.value); }}
            />
          ) : (
            <Input
              {...accessibility}
              type={type}
              autoComplete={autoComplete}
              required={required}
              spellCheck={type === "text" ? undefined : false}
              onInvalid={(event) => setValidation({ value, message: event.currentTarget.validationMessage })}
              onChange={(event) => { setValidation({ value: "", message: "" }); onChange(event.target.value); }}
            />
          )}
        </div>
        {invalid && <FieldError id={`${id}-error`}>{invalid}</FieldError>}
      </div>
    </Field>
  );
}
