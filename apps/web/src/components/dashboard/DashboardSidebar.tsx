"use client";

import Image from "next/image";

import type { Reader } from "@/types/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Icon } from "@/lib/icons/inline-icon";
import { cn } from "@/lib/utils";
import { Link } from "@/locales/navigation";
import { DashboardAccount } from "./DashboardAccount";
import { DashboardNavigation } from "./DashboardNavigation";

interface DashboardSidebarProps {
  user: Reader;
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** 按 admin-react 保留顶部工作区、紧凑导航、底部用户菜单三段结构。 */
export function DashboardSidebar({ user, collapsed = false, onNavigate }: DashboardSidebarProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-muted", collapsed ? "w-14" : "w-61")}>
      <div className="flex h-13 shrink-0 items-center gap-2 px-3">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="站点菜单" className={cn("flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center px-0")}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[0.3125rem] bg-primary text-[0.6875rem] font-medium text-primary-foreground">N</span>
              {!collapsed && <><span className="flex-1 truncate text-left text-[0.8125rem] font-medium tracking-[-0.00625em]">Neo Space</span><Icon icon="mingcute:down-line" className="size-3.5 text-muted-foreground" aria-hidden="true" /></>}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 rounded-lg p-1 motion-reduce:animate-none">
            <Link href="/" onClick={onNavigate} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"><Icon icon="mingcute:external-link-line" className="size-3.5" aria-hidden="true" />查看前台网站</Link>
          </PopoverContent>
        </Popover>
        {!collapsed && (
          <Link href="/dashboard/posts/new" onClick={onNavigate} aria-label="写文章" title="写文章" className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <Icon icon="mingcute:edit-3-line" className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto"><DashboardNavigation collapsed={collapsed} onNavigate={onNavigate} layoutScope="sidebar" /></div>
      <footer className={cn("shrink-0 px-3 pb-5 pt-4", collapsed && "px-1.5")}>
        <DashboardAccount user={user} collapsed={collapsed} />
      </footer>
    </div>
  );
}
