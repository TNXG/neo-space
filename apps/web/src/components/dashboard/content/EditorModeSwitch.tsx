"use client";

import { motion } from "motion/react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

export type EditorMode = "rich" | "split" | "source";

export const EDITOR_MODES: { value: EditorMode; label: string; icon: string; shortcut: string }[] = [
  { value: "rich", label: "所见即所得", icon: "mingcute:edit-2-line", shortcut: "1" },
  { value: "split", label: "源码 + 预览", icon: "mingcute:layout-right-line", shortcut: "2" },
  { value: "source", label: "源码", icon: "mingcute:code-line", shortcut: "3" },
];

interface EditorModeSwitchProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  /** 窄屏没有足够空间并排，隐藏分栏选项。 */
  allowSplit: boolean;
}

/**
 * 三段式模式切换；选中背景通过 layoutId 在选项间滑动，用户能看清自己从哪切到了哪。
 * @param props 当前模式与切换回调
 * @returns 分段控件
 */
export function EditorModeSwitch({ mode, onChange, allowSplit }: EditorModeSwitchProps) {
  const modes = allowSplit ? EDITOR_MODES : EDITOR_MODES.filter(item => item.value !== "split");
  return (
    <div role="radiogroup" aria-label="编辑模式" className="flex items-center gap-0.5 rounded-xl bg-secondary/70 p-0.5">
      {modes.map(item => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={mode === item.value}
          aria-label={item.label}
          aria-keyshortcuts={`Control+${item.shortcut} Meta+${item.shortcut}`}
          title={`${item.label}（⌘ / Ctrl ${item.shortcut}）`}
          onPointerDown={(event) => {
            // 按下即切换，响应不必等到抬起。
            if (event.button === 0) onChange(item.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onChange(item.value);
            }
          }}
          className={cn(
            "relative flex h-7 cursor-pointer items-center gap-1.5 rounded-[0.625rem] px-2.5 text-xs font-medium outline-none transition-colors duration-(--motion-duration-fast) focus-visible:ring-2 focus-visible:ring-ring",
            mode === item.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode === item.value && (
            <motion.span
              layoutId="editor-mode-indicator"
              transition={{ type: "spring", duration: 0.32, bounce: 0 }}
              className="absolute inset-0 rounded-[0.625rem] bg-background shadow-xs ring-1 ring-border/60"
              aria-hidden="true"
            />
          )}
          <Icon icon={item.icon} className="relative size-3.5" aria-hidden="true" />
          <span className="relative hidden xl:inline">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
