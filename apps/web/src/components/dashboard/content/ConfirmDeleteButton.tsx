"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

/**
 * 两段式删除：第一次点击变为「确认删除」，3 秒内再次点击才执行；非阻断且误触可自然撤回。
 * @param props 删除回调与标签
 * @returns 删除按钮
 */
export function ConfirmDeleteButton({ onConfirm, label }: { onConfirm: () => Promise<unknown>; label: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={armed ? `确认删除${label}` : `删除${label}`}
      disabled={pending}
      onBlur={() => setArmed(false)}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!armed) {
          setArmed(true);
          window.setTimeout(setArmed, 3000, false);
          return;
        }
        setPending(true);
        try {
          await onConfirm();
        } finally {
          setPending(false);
          setArmed(false);
        }
      }}
      className={cn("h-8 rounded-lg px-2.5", armed ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive" : "text-muted-foreground")}
    >
      <Icon icon={armed ? "mingcute:alert-line" : "mingcute:delete-2-line"} data-icon="inline-start" aria-hidden="true" />
      <span className={cn(!armed && "sr-only")}>{pending ? "删除中" : "确认删除"}</span>
    </Button>
  );
}
