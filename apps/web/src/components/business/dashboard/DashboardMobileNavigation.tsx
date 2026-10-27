"use client";

import type { Reader } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { DashboardAccount } from "./DashboardAccount";
import { DashboardNavigation } from "./DashboardNavigation";

interface DashboardMobileNavigationProps {
  user: Reader;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 移动导航按内容收拢，不继承桌面侧栏的撑满高度与底部停靠。 */
export function DashboardMobileNavigation({ user, open, onOpenChange }: DashboardMobileNavigationProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="打开导航" className="lg:hidden">
          <Icon icon="mingcute:menu-line" aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-background motion-reduce:transition-none">
        <DrawerHeader className="flex-row items-center justify-between border-0 px-5 pb-3 pt-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <div className="flex flex-col gap-1">
            <DrawerTitle>Neo Space</DrawerTitle>
            <DrawerDescription>管理面板</DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="关闭导航">
              <Icon icon="mingcute:close-line" aria-hidden="true" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <DashboardNavigation onNavigate={() => onOpenChange(false)} layoutScope="drawer" />
          <div className="px-3 pt-2">
            <Button variant="ghost" asChild className="h-11 w-full justify-start px-2.5">
              <Link href="/" onClick={() => onOpenChange(false)}>
                <Icon icon="mingcute:external-link-line" data-icon="inline-start" aria-hidden="true" />访问站点
              </Link>
            </Button>
          </div>
          <footer className="px-3 pt-5"><DashboardAccount user={user} /></footer>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
