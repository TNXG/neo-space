"use client";

import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { KbdShortcut } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/lib/inline-icon";

/** 集合条目需先展开才渲染输入，逐帧重试直到字段出现，再滚动居中并高亮。 */
export function focusSettingsField(root: HTMLElement | null, path: string, attempt = 0) {
  const target = root?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
  if (!target) {
    if (attempt < 10) requestAnimationFrame(() => focusSettingsField(root, path, attempt + 1));
    return;
  }
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.querySelector<HTMLElement>("input, select, textarea, [role=switch], [role=combobox]")?.focus({ preventScroll: true });
  target.animate([{ backgroundColor: "color-mix(in oklab, var(--destructive) 12%, transparent)" }, { backgroundColor: "transparent" }], { duration: 1200, easing: "ease-out" });
}

interface SettingsSaveBarProps {
  dirty: boolean;
  pending: boolean;
  disabled: boolean;
  /** 每次校验失败递增，驱动操作条轻微晃动提示。 */
  attention: number;
  saveLabel: string;
}

/** 仅在存在修改时从底部浮出，操作始终贴近视线，不需滚回页首。 */
export function SettingsSaveBar({ dirty, pending, disabled, attention, saveLabel }: SettingsSaveBarProps) {
  const controls = useAnimationControls();

  useEffect(() => {
    if (attention > 0) void controls.start({ transform: ["translateX(0px)", "translateX(-6px)", "translateX(6px)", "translateX(-3px)", "translateX(0px)"], transition: { duration: 0.32, ease: "easeOut" } });
  }, [attention, controls]);

  return (
    <div className="pointer-events-none sticky bottom-0 z-20 flex justify-center px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-6">
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-auto w-full max-w-xl"
          >
            <motion.div
              animate={controls}
              role="region"
              aria-label="未保存的修改"
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/85 py-2 pr-2 pl-4 shadow-lg backdrop-blur-xl"
            >
              <span className="relative flex size-2 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{pending ? "正在保存…" : "有未保存的修改"}</p>
              <Button type="reset" variant="ghost" size="sm" disabled={disabled}>放弃</Button>
              <Button type="submit" size="sm" disabled={disabled} className="min-w-24">
                {pending
                  ? <Spinner data-icon="inline-start" aria-hidden="true" />
                  : <Icon icon="mingcute:check-line" data-icon="inline-start" aria-hidden="true" />}
                {pending ? "保存中" : saveLabel}
                {!pending && <KbdShortcut keys={["Ctrl", "S"]} className="ml-1 hidden opacity-80 lg:inline-flex [&_kbd]:border-white/30 [&_kbd]:bg-white/15 [&_kbd]:text-white [&_kbd]:shadow-none" />}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 表单状态提示进出带高度过渡，避免突然出现的提示把内容向下推跳。 */
export function SettingsNotice({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -6 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 校验问题列表可点击直达对应字段。 */
export function SettingsIssueList({ issues, onSelect }: { issues: readonly { path: string; message: string }[]; onSelect: (path: string) => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {issues.slice(0, 6).map((issue, index) => (
        <li key={`${issue.path}-${index}`}>
          <button type="button" onClick={() => onSelect(issue.path)} className="group/issue flex cursor-pointer items-center gap-1.5 rounded-md text-left underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            <Icon icon="mingcute:arrow-right-line" className="size-3.5 shrink-0 transition-transform duration-(--motion-duration-fast) group-hover/issue:translate-x-0.5" aria-hidden="true" />
            {issue.message}
          </button>
        </li>
      ))}
      {issues.length > 6 && <li className="pl-5">以及另外 {issues.length - 6} 项</li>}
    </ul>
  );
}
