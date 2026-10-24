"use client";

import type { ReactNode } from "react";
import type { Reader } from "@/types/api";
import { useEffect, useState } from "react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { usePathname } from "@/locales/navigation";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardMobileNavigation } from "./DashboardMobileNavigation";

/** 复用参考项目的侧栏与内嵌内容面板比例；不添加额外欢迎区。 */
export function DashboardShell({ user, children }: { user: Reader; children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    /** 快捷键仅作用于桌面且不拦截输入、编辑器或输入法组合。 */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b" || event.isComposing || event.repeat) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=textbox]")) return;
      event.preventDefault();
      setCollapsed(value => !value);
    };
    /** 切回桌面时关闭移动面板，避免隐藏遮罩保留页面滚动锁。 */
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeMobile = () => { if (desktop.matches) setMobileOpen(false); };
    window.addEventListener("keydown", handleKeyDown);
    desktop.addEventListener("change", closeMobile);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", closeMobile);
    };
  }, []);

  return (
    <div className="flex h-svh overflow-hidden bg-muted text-foreground leading-[1.6]">
      <a href="#main-content" className="sr-only cursor-pointer rounded-lg bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">跳至主要内容</a>
      <aside id="dashboard-sidebar" aria-label="工作空间侧栏" className={cn("hidden shrink-0 lg:block", collapsed ? "w-14" : "w-[15.25rem]")}>
        <DashboardSidebar user={user} collapsed={collapsed} />
      </aside>
      <div className="my-2 mr-2 ml-1.5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/50 px-4">
          <button type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "展开侧栏" : "收起侧栏"} aria-expanded={!collapsed} aria-controls="dashboard-sidebar" aria-keyshortcuts="Control+b Meta+b" title="切换侧栏（⌘ / Ctrl B）" className="hidden size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:flex">
            <Icon icon={collapsed ? "mingcute:right-line" : "mingcute:left-line"} className="size-4" aria-hidden="true" />
          </button>
          <DashboardMobileNavigation user={user} open={mobileOpen} onOpenChange={setMobileOpen} />
          <h1 className="text-[0.8125rem] font-medium">{pathname.startsWith("/dashboard/settings") ? "设置" : "仪表盘"}</h1>
        </header>
        <main id="main-content" tabIndex={-1} className={cn("min-h-0 flex-1 outline-none", pathname.startsWith("/dashboard/settings") ? "overflow-hidden" : "overflow-y-auto overscroll-contain p-4 lg:p-6")}>{children}</main>
      </div>
    </div>
  );
}
