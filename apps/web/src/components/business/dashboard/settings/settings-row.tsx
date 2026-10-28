"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/lib/inline-icon";
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

/** 字段说明：一段连续文字承载用途与注意事项，环境变量以标记呈现，不再堆叠多行灰字。 */
function RowDescription({ id, hint, help, env, disabledHint }: Pick<SettingsRowProps, "id" | "hint" | "help" | "env" | "disabledHint">) {
  const text = [hint, help].filter(Boolean).join("");
  return (
    <>
      {disabledHint ? (
        <p id={`${id}-hint`} className="flex items-start gap-1.5 text-[0.8125rem] leading-relaxed text-foreground/80">
          <Icon icon="mingcute:lock-line" className="mt-[0.2rem] size-3.5 shrink-0" aria-hidden="true" />
          {disabledHint}
        </p>
      ) : (
        text && <p id={`${id}-hint`} className="text-[0.8125rem] leading-relaxed text-muted-foreground">{text}</p>
      )}
      {env && (
        <Badge variant="outline" className="mt-0.5 max-w-full gap-1 font-mono font-normal text-muted-foreground" title="部署环境变量存在时优先于此处的值">
          <Icon icon="mingcute:terminal-box-line" aria-hidden="true" />
          <span className="truncate">{env}</span>
        </Badge>
      )}
    </>
  );
}

/** 统一字段行：桌面端标签与控件左右对齐，移动端自然堆叠。 */
export function SettingsRow({ id, controlId, path, label, hint, help, env, error, disabledHint, variant = "stacked", children }: SettingsRowProps) {
  if (variant === "switch") {
    return (
      <div data-path={path} data-invalid={Boolean(error) || undefined} className="flex items-start justify-between gap-6 py-4">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <FieldLabel htmlFor={controlId} className="cursor-pointer text-sm font-medium">{label}</FieldLabel>
          <RowDescription id={id} hint={hint} help={help} env={env} disabledHint={disabledHint} />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <div className="flex shrink-0 items-center pt-0.5">{children}</div>
      </div>
    );
  }

  return (
    <div data-path={path} data-invalid={Boolean(error) || undefined} className="grid gap-2.5 py-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10">
      <div className="flex min-w-0 flex-col items-start gap-1 lg:pt-2">
        <FieldLabel htmlFor={controlId} className="text-sm font-medium">{label}</FieldLabel>
        <RowDescription id={id} hint={hint} help={help} env={env} disabledHint={disabledHint} />
      </div>
      <div className={cn("flex min-w-0 flex-col gap-1.5", disabledHint && "opacity-60")}>
        {children}
        {error && <FieldError>{error}</FieldError>}
      </div>
    </div>
  );
}
