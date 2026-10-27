"use client";

import type { ReactNode } from "react";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  id: string;
  controlId?: string;
  path: string;
  label: string;
  hint?: string;
  help?: string;
  env?: string;
  error?: string;
  disabledHint?: string;
  variant?: "stacked" | "switch";
  children: ReactNode;
}

/** 统一字段行：文字全部以原生流式呈现，无飘窗弹层，在移动端不会截断溢出。 */
export function SettingsRow({ id, controlId, path, label, hint, help, env, error, disabledHint, variant = "stacked", children }: SettingsRowProps) {
  const descriptionId = `${id}-hint`;
  const infoText = disabledHint || hint;

  if (variant === "switch") {
    return (
      <div data-path={path} className="flex items-start justify-between gap-4 py-3.5">
        <div className="flex min-w-0 flex-col gap-1 pr-2">
          <FieldLabel htmlFor={controlId} className="text-sm font-medium">{label}</FieldLabel>
          {infoText && <p id={descriptionId} className={cn("text-[13px] text-foreground/70 leading-relaxed", disabledHint && "text-amber-600 dark:text-amber-400 font-medium")}>{infoText}</p>}
          {help && <p className="text-[13px] text-foreground/70 leading-relaxed">{help}</p>}
          {env && <p className="font-mono text-xs text-muted-foreground break-all">环境变量优先: {env}</p>}
          {error && <FieldError>{error}</FieldError>}
        </div>
        <div className="flex shrink-0 items-center pt-0.5">{children}</div>
      </div>
    );
  }

  return (
    <div data-path={path} className="grid gap-2 py-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-1">
        <FieldLabel htmlFor={controlId} className="text-sm font-medium">{label}</FieldLabel>
        {infoText && <p id={descriptionId} className={cn("text-[13px] text-foreground/70 leading-relaxed", disabledHint && "text-amber-600 dark:text-amber-400 font-medium")}>{infoText}</p>}
        {help && <p className="text-[13px] text-foreground/70 leading-relaxed">{help}</p>}
        {env && <p className="font-mono text-xs text-muted-foreground break-all">环境变量优先: {env}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {children}
        {error && <FieldError>{error}</FieldError>}
      </div>
    </div>
  );
}
