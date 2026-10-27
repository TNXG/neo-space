"use client";

import type { ReactNode } from "react";
import type { Reader } from "@/types/api";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/locales/navigation";
import { settingLinks } from "./DashboardNavigation";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardMobileNavigation } from "./DashboardMobileNavigation";

const COLLAPSE_KEY = "neo-dashboard-sidebar-collapsed";

/** 侧栏与内嵌内容面板；外壳跨路由常驻，仅内容区执行进出场过渡。 */
export function DashboardShell({ user, children }: { user: Reader; children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const settings = pathname.startsWith("/dashboard/settings");
  const page = settingLinks.find(item => item.href === pathname);

  // 折叠偏好只是界面布局，不含业务数据，可安全持久化。
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    /** 快捷键仅作用于桌面且不拦截输入、编辑器或输入法组合。 */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.isComposing || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        const form = document.querySelector<HTMLFormElement>("form[data-settings-form]");
        if (!form) return;
        event.preventDefault();
        form.requestSubmit();
        return;
      }
      if (key !== "b" || !window.matchMedia("(min-width: 1024px)").matches) return;
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
      <motion.aside
        id="dashboard-sidebar"
        aria-label="工作空间侧栏"
        initial={false}
        animate={{ width: collapsed ? "3.5rem" : "15.25rem" }}
        transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
        className="hidden shrink-0 overflow-hidden lg:block"
      >
        <DashboardSidebar user={user} collapsed={collapsed} />
      </motion.aside>
      <div className="my-2 mr-2 ml-1.5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background max-lg:m-0 max-lg:rounded-none max-lg:border-0">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/50 px-4">
          <button type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "展开侧栏" : "收起侧栏"} aria-expanded={!collapsed} aria-controls="dashboard-sidebar" aria-keyshortcuts="Control+b Meta+b" title="切换侧栏（⌘ / Ctrl B）" className="hidden size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:flex">
            <Icon icon="mingcute:layout-leftbar-close-line" className={cn("size-4 transition-transform duration-[var(--motion-duration-page)] ease-[var(--motion-ease-out)]", collapsed && "rotate-180")} aria-hidden="true" />
          </button>
          <DashboardMobileNavigation user={user} open={mobileOpen} onOpenChange={setMobileOpen} />
          <nav aria-label="当前位置" className="flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
            {settings ? <>
              <Link href="/dashboard" className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">仪表盘</Link>
              <Icon icon="mingcute:right-line" className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <span className="text-muted-foreground">设置</span>
              <Icon icon="mingcute:right-line" className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.h1 key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="truncate font-medium">{page?.title ?? "设置"}</motion.h1>
              </AnimatePresence>
            </> : <h1 className="font-medium">仪表盘</h1>}
          </nav>
        </header>
        <main id="main-content" tabIndex={-1} className="relative min-h-0 flex-1 overflow-hidden outline-none">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10, scale: 0.995, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className={cn("h-full", !settings && "overflow-y-auto overscroll-contain")}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
