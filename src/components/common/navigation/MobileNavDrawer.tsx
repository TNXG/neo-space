"use client";

import { Icon } from "@iconify/react/offline";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLinkClick = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>导航菜单</DrawerTitle>
          <DrawerDescription>探索更多精彩内容</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="px-4 py-0">
          <div className="flex flex-col gap-2 py-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <button
                  key={item.id}
                  onClick={() => handleLinkClick(item.href)}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 text-left group",
                    isActive
                      ? "bg-accent-50 text-accent-900 dark:bg-accent-900/20 dark:text-accent-100"
                      : "hover:bg-secondary/50 text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
                      isActive
                        ? "bg-accent-100 text-accent-600 dark:bg-accent-800/40 dark:text-accent-300"
                        : "bg-secondary/50 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground",
                    )}
                  >
                    <Icon icon={item.icon} className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className={cn("font-medium text-base", isActive && "font-semibold")}>
                      {item.title}
                    </span>
                  </div>
                  {isActive && (
                    <div className="ml-auto">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DrawerBody>
        <div className="h-6" />
        {" "}
        {/* Bottom spacer */}
      </DrawerContent>
    </Drawer>
  );
}
