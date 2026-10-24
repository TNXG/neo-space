"use client";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/lib/inline-icon";
import { Link, usePathname } from "@/locales/navigation";
import { optionGroups } from "./settings/options/option-groups";

const settingLinks = [
  { href: "/dashboard/settings/profile", title: "用户", icon: "mingcute:user-3-line" },
  ...optionGroups.map(group => ({ href: `/dashboard/settings/${group.slug}`, title: group.title, icon: group.icon })),
];

interface DashboardNavigationProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** 设置分组只在外侧保留，折叠及按钮语义交给 shadcn/ui。 */
export function DashboardNavigation({ collapsed = false, onNavigate }: DashboardNavigationProps) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/dashboard/settings");
  return (
    <nav aria-label="后台导航" className="flex flex-col gap-1 px-3 py-1">
      <Button asChild variant={pathname === "/dashboard" ? "secondary" : "ghost"} size={collapsed ? "icon-sm" : "sm"} className={collapsed ? "w-full" : "w-full justify-start max-lg:h-11"}>
        <Link href="/dashboard" onClick={onNavigate} aria-current={pathname === "/dashboard" ? "page" : undefined} title={collapsed ? "仪表盘" : undefined}>
          <Icon icon="mingcute:home-3-line" data-icon="inline-start" aria-hidden="true" /><span className={collapsed ? "sr-only" : "truncate"}>仪表盘</span>
        </Link>
      </Button>
      <Button type="button" variant="ghost" size={collapsed ? "icon-sm" : "sm"} disabled aria-label="文章（尚未接入）" title="文章管理尚未接入" className={collapsed ? "w-full" : "w-full justify-start max-lg:h-11"}>
        <Icon icon="mingcute:document-2-line" data-icon="inline-start" aria-hidden="true" /><span className={collapsed ? "sr-only" : "truncate"}>文章</span>
      </Button>
      {collapsed ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant={settingsActive ? "secondary" : "ghost"} size="icon-sm" className="mt-4 w-full" aria-label="设置菜单" title="设置"><Icon icon="mingcute:settings-3-line" aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuGroup>
              {settingLinks.map(item => <DropdownMenuItem key={item.href} asChild><Link href={item.href} onClick={onNavigate} aria-current={pathname === item.href ? "page" : undefined}><Icon icon={item.icon} aria-hidden="true" />{item.title}</Link></DropdownMenuItem>)}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Collapsible defaultOpen className="group mt-4">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start max-lg:h-11">
              <Icon icon="mingcute:settings-3-line" data-icon="inline-start" aria-hidden="true" /><span className="flex-1 text-left">设置</span><Icon icon="mingcute:right-line" data-icon="inline-end" className="group-data-[state=open]:rotate-90" aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1 pt-1 pl-6">
            {settingLinks.map(item => <Button key={item.href} asChild variant={pathname === item.href ? "secondary" : "ghost"} size="sm" className="w-full justify-start max-lg:h-11">
              <Link href={item.href} onClick={onNavigate} aria-current={pathname === item.href ? "page" : undefined}><Icon icon={item.icon} data-icon="inline-start" aria-hidden="true" /><span>{item.title}</span></Link>
            </Button>)}
          </CollapsibleContent>
        </Collapsible>
      )}
    </nav>
  );
}
