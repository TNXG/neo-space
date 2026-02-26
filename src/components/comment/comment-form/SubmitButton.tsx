"use client";

import LoadingLine from "~icons/mingcute/loading-line";
import SendPlaneFill from "~icons/mingcute/send-plane-fill";

import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
  isPending: boolean;
}

/**
 * 评论提交按钮
 */
export function SubmitButton({ onClick, disabled, isPending }: SubmitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-xs font-bold transition-all shadow-sm min-h-[36px] sm:h-8 cursor-pointer",
        !disabled
          ? "bg-accent-600 text-white hover:bg-accent-500 hover:shadow-accent-500/20 active:scale-95"
          : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
      )}
    >
      {isPending
        ? <LoadingLine className="animate-spin size-4 sm:size-4" />
        : <SendPlaneFill className="size-4 sm:size-4" />}
      <span>发送</span>
    </button>
  );
}
