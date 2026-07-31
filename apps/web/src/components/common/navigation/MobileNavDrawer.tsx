"use client";

import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "@/locales/navigation";

import { LanguageSwitch } from "./LanguageSwitch";
import { getNavigationTransitionType, NAV_ITEMS } from "./nav-config";

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  const handleLinkClick = (href: string) => {
    onOpenChange(false);
    router.push(href, {
      transitionTypes: [getNavigationTransitionType(pathname, href)],
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{t("nav.menuTitle")}</DrawerTitle>
          <DrawerDescription>{t("nav.menuDescription")}</DrawerDescription>
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
                    "flex items-center gap-4 p-3 rounded-2xl transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200 text-left group",
                    isActive
                      ? "bg-accent-50 text-accent-900"
                      : "hover:bg-secondary/50 text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
                      isActive
                        ? "bg-accent-100 text-accent-600"
                        : "bg-secondary/50 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground",
                    )}
                  >
                    <Icon icon={item.icon} className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className={cn("font-medium text-base", isActive && "font-semibold")}>
                      {t(`nav.${item.id}`)}
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

          <div className="mt-2 border-t border-border/60 pt-2">
            <LanguageSwitch inline onLocaleChange={() => onOpenChange(false)} />
          </div>
        </DrawerBody>
        <div className="h-6" />
        {" "}
        {/* Bottom spacer */}
      </DrawerContent>
    </Drawer>
  );
}
