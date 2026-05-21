"use client";

import type { TurnstileStatus as TurnstileStatusType } from "./types";
import { useTranslations } from "next-intl";
import { Icon } from "@/lib/inline-icon";

interface TurnstileStatusProps {
  status: TurnstileStatusType;
}

/**
 * Turnstile 验证状态显示组件
 */
export function TurnstileStatus({ status }: TurnstileStatusProps) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-1.5">
      {status === "loading" && (
        <>
          <Icon icon="mingcute:loading-line" className="w-3 h-3 text-muted-foreground animate-spin" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">{t("comment.turnstile.loadingShort")}</span>
        </>
      )}
      {status === "verifying" && (
        <>
          <Icon icon="mingcute:loading-line" className="w-3 h-3 text-blue-500 animate-spin" />
          <span className="text-[10px] sm:text-xs text-blue-600">{t("comment.turnstile.verifyingShort")}</span>
        </>
      )}
      {status === "verified" && (
        <>
          <Icon icon="mingcute:check-circle-fill" className="w-3 h-3 text-green-500" />
          <span className="text-[10px] sm:text-xs text-green-600">{t("comment.turnstile.verified")}</span>
        </>
      )}
      {status === "error" && (
        <>
          <Icon icon="mingcute:close-circle-fill" className="w-3 h-3 text-red-500" />
          <span className="text-[10px] sm:text-xs text-red-600">{t("comment.turnstile.failed")}</span>
        </>
      )}
    </div>
  );
}
