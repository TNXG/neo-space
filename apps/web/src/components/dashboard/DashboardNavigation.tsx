"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/locales/navigation";
import { useProfileDraftStore, useSettingsDrafts } from "./settings/use-settings-draft";
import { useContentDraftStore } from "./content/use-content-editor";
import { settingGroups } from "./settings/settings-groups";

export const settingLinks = [
  { href: "/dashboard/settings/profile", title: "用户", icon: "mingcute:user-3-line", key: "profile", help: "昵称、头像与社交链接" },
  ...settingGroups.map(group => ({ href: `/dashboard/settings/${group.slug}`, title: group.title, icon: group.icon, key: group.key as string, help: group.help })),
];

interface DashboardNavigationProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  /** 桌面侧栏与移动抽屉各自独立的指示器动画通道。 */
  layoutScope: string;
}

interface NavItemProps {
  href: string;
  title: string;
  icon: string;
  active: boolean;
  unsaved?: boolean;
  collapsed: boolean;
  layoutScope: string;
  onNavigate?: () => void;
}

/** 当前项背景通过 layoutId 在条目之间滑动，用户能直接看到位置变化。 */
function NavItem({ href, title, icon, active, unsaved, collapsed, layoutScope, onNavigate }: NavItemProps) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? title : undefined}
      className={cn(
        "relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[0.8125rem] outline-none transition-colors duration-(--motion-duration-fast) focus-visible:ring-2 focus-visible:ring-ring max-lg:h-11",
        active ? "font-medium text-foreground" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <motion.span layoutId={`${layoutScope}-nav-active`} transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-lg bg-background shadow-xs ring-1 ring-border/60" aria-hidden="true" />}
      <Icon icon={icon} className="relative size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="relative flex-1 truncate">{title}</span>}
      {unsaved && <span aria-label="有未保存修改" title="有未保存修改" className={cn("relative size-1.5 shrink-0 rounded-full bg-primary", collapsed && "absolute top-1.5 right-1.5")} />}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{title}</TooltipContent>
    </Tooltip>
  );
}

/** 设置分组只在外侧保留，折叠及按钮语义交给 shadcn/ui。 */
export function DashboardNavigation({ collapsed = false, onNavigate, layoutScope }: DashboardNavigationProps) {
  const pathname = usePathname();
  const drafts = useSettingsDrafts();
  const profileDirty = useProfileDraftStore(state => state.draft !== undefined);
  const contentDrafts = useContentDraftStore(state => state.drafts);
  const settingsActive = pathname.startsWith("/dashboard/settings");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const unsaved = new Set([...Object.keys(drafts), ...(profileDirty ? ["profile"] : [])]);
  const anyUnsaved = unsaved.size > 0;

  return (
    <nav aria-label="后台导航" className="flex flex-col gap-0.5 px-3 py-1">
      <NavItem href="/dashboard" title="仪表盘" icon="mingcute:home-3-line" active={pathname === "/dashboard"} collapsed={collapsed} layoutScope={layoutScope} onNavigate={onNavigate} />
      <NavItem href="/dashboard/posts" title="文章" icon="mingcute:document-2-line" active={pathname.startsWith("/dashboard/posts")} unsaved={Object.keys(contentDrafts).some(key => key.startsWith("post:"))} collapsed={collapsed} layoutScope={layoutScope} onNavigate={onNavigate} />
      <NavItem href="/dashboard/pages" title="页面" icon="mingcute:file-line" active={pathname.startsWith("/dashboard/pages")} unsaved={Object.keys(contentDrafts).some(key => key.startsWith("page:"))} collapsed={collapsed} layoutScope={layoutScope} onNavigate={onNavigate} />
      {collapsed ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant={settingsActive ? "secondary" : "ghost"} size="icon-sm" className="relative mt-4 w-full rounded-lg" aria-label="设置菜单" title="设置">
              <Icon icon="mingcute:settings-3-line" aria-hidden="true" />
              {anyUnsaved && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8}>
            <DropdownMenuGroup>
              {settingLinks.map(item => <DropdownMenuItem key={item.href} asChild><Link href={item.href} onClick={onNavigate} aria-current={pathname === item.href ? "page" : undefined}><Icon icon={item.icon} aria-hidden="true" />{item.title}{unsaved.has(item.key) && <span aria-label="有未保存修改" title="有未保存修改" className="ml-auto size-1.5 rounded-full bg-primary" />}</Link></DropdownMenuItem>)}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="group mt-4">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[0.6875rem] font-medium tracking-[0.08em] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-lg:h-10">
              <Icon icon="mingcute:settings-3-line" className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">设置</span>
              {!settingsOpen && anyUnsaved && <span aria-label="有未保存修改" className="size-1.5 rounded-full bg-primary" />}
              <Icon icon="mingcute:right-line" className="size-3.5 transition-transform duration-(--motion-duration-fast) ease-(--motion-ease-out) group-data-[state=open]:rotate-90" aria-hidden="true" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="panel-collapsible">
            <div className="flex flex-col gap-0.5 pt-0.5">
              {settingLinks.map(item => <NavItem key={item.href} href={item.href} title={item.title} icon={item.icon} active={pathname === item.href} unsaved={unsaved.has(item.key)} collapsed={false} layoutScope={layoutScope} onNavigate={onNavigate} />)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </nav>
  );
}
