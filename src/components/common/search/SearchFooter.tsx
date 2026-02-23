"use client";

import { KbdShortcut } from "@/components/ui/kbd";
import { MeiliSearchIcon } from "@/lib/file-icons";

export function SearchFooter() {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 text-xs text-muted-foreground/60">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <KbdShortcut keys={["Up"]} />
          <KbdShortcut keys={["Down"]} />
          导航
        </span>
        <span className="flex items-center gap-1">
          <KbdShortcut keys={["Enter"]} />
          确认
        </span>
        <span className="flex items-center gap-1">
          <KbdShortcut keys={["Esc"]} />
          关闭
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span>Powered by</span>
        <div className="text-neutral-600 dark:text-neutral-300">
          <MeiliSearchIcon
            style={{ height: "14px", width: "84px" }}
            className="transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
