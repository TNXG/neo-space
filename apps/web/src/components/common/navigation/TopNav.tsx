"use client";

import type { NavItem } from "./nav-config";
import type { User } from "@/types/api";

import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { ThemeToggle } from "@/components/common/theme";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/locales/navigation";

import { LanguageSwitch } from "./LanguageSwitch";
import { getNavigationTransitionType, NAV_ITEMS } from "./nav-config";
import styles from "./nav-menu.module.scss";
import { dropdownPanelMap } from "./NavDropdownPanels";

const FROSTED_FILTER_CLASS
  = "backdrop-blur-lg reduced-transparency:backdrop-blur-none";

const ACTION_BTN_CLASS = cn(
  "w-10 h-10 rounded-full flex items-center justify-center cursor-pointer",
  styles.frostedControl,
  FROSTED_FILTER_CLASS,
  "text-muted-foreground hover:text-accent-600",
  "active:scale-95 will-change-transform",
);

interface TopNavProps {
  user: User;
  isNavVisible: boolean;
  setIsNavVisible: (visible: boolean) => void;
  setIsDrawerOpen: (open: boolean) => void;
  setIsSearchOpen: (open: boolean) => void;
  isConnected: boolean;
  onlineCount: number;
}

export function TopNav({
  user,
  isNavVisible,
  setIsNavVisible: _setIsNavVisible,
  setIsDrawerOpen,
  setIsSearchOpen,
  isConnected,
  onlineCount,
}: TopNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [menuValue, setMenuValue] = useState<string | null>(null);

  const handleNavClick = useCallback(
    (e: React.MouseEvent, item: NavItem) => {
      if (item.href.startsWith("/#") && isHomePage) {
        e.preventDefault();
        document.querySelector(item.href.slice(1))?.scrollIntoView({ behavior: "smooth" });
      }
    },
    [isHomePage],
  );

  const navAnimClass = cn(
    "transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
    isNavVisible
      ? "translate-y-0 opacity-100"
      : "-translate-y-12 opacity-0 pointer-events-none blur-sm",
  );

  return (
    <div className="view-transition-navigation fixed top-0 inset-x-0 z-50 pointer-events-none pt-4 h-18">
      <div className="relative mx-auto flex h-full w-full max-w-[calc(100vw-2rem)] md:max-w-7xl items-center justify-between">
        {/* Left (Mobile trigger) */}
        <div className="flex flex-1 items-center justify-start pointer-events-none">
          <div className="sm:hidden">
            <div
              className={cn("pointer-events-auto", ACTION_BTN_CLASS, navAnimClass)}
              onClick={(e) => {
                e.stopPropagation();
                setIsDrawerOpen(true);
              }}
            >
              <Icon icon="mingcute:menu-line" className="text-lg md:text-xl" />
            </div>
          </div>
        </div>

        {/* Center (Nav Pill) */}
        <div className="hidden sm:flex justify-center shrink-0">
          <NavigationMenu.Root
            closeDelay={150}
            delay={80}
            value={menuValue}
            onValueChange={setMenuValue}
            className={cn(
              "pointer-events-auto relative flex items-center",
              "h-12 rounded-full",
              styles.frostedNav,
              FROSTED_FILTER_CLASS,
              "will-change-transform",
              navAnimClass,
            )}
          >
            {/* Navigation items (desktop) */}
            <NavigationMenu.List className="flex h-full list-none items-center gap-1 px-2 font-medium text-foreground/80">
              {NAV_ITEMS.map((item) => {
                const isActive
                  = item.href === "/" ? isHomePage : pathname.startsWith(item.href);
                const itemTitle = t(`nav.${item.id}`);
                const DropdownPanel = item.dropdownType
                  ? dropdownPanelMap[item.dropdownType]
                  : undefined;

                if (DropdownPanel) {
                  return (
                    <NavigationMenu.Item key={item.id} value={item.id}>
                      <NavigationMenu.Trigger
                        nativeButton={false}
                        render={(
                          <Link
                            href={item.href}
                            transitionTypes={[getNavigationTransitionType(pathname, item.href)]}
                            onClick={e => handleNavClick(e, item)}
                          />
                        )}
                        className={cn(
                          "relative inline-flex items-center whitespace-nowrap border-none bg-transparent px-3 py-2 text-sm cursor-pointer transition duration-200",
                          isActive ? "text-accent-600" : "hover:text-accent-600/80",
                        )}
                      >
                        <span className="relative flex items-center gap-1.5">
                          {isActive && (
                            <motion.span
                              className="flex items-center"
                              layoutId="header-menu-icon"
                            >
                              <Icon icon={item.icon} className="text-sm" />
                            </motion.span>
                          )}
                          <motion.span layout>{itemTitle}</motion.span>
                        </span>

                        {isActive && (
                          <motion.span
                            layoutId="active-nav-item"
                            className="absolute inset-x-1 -bottom-px h-px bg-linear-to-r from-accent-500/0 via-accent-500/70 to-accent-500/0"
                          />
                        )}
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content className={styles.content}>
                        <DropdownPanel
                          user={user}
                          isConnected={isConnected}
                          onlineCount={onlineCount}
                        />
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  );
                }

                // Simple link (no dropdown)
                return (
                  <NavigationMenu.Item key={item.id}>
                    <NavigationMenu.Link
                      active={isActive}
                      render={(
                        <Link
                          href={item.href}
                          transitionTypes={[getNavigationTransitionType(pathname, item.href)]}
                          onClick={e => handleNavClick(e, item)}
                        />
                      )}
                      className={cn(
                        "relative block whitespace-nowrap px-3 py-2 text-sm transition duration-200",
                        isActive ? "text-accent-600" : "hover:text-accent-600/80",
                      )}
                    >
                      <span className="relative flex items-center gap-1.5">
                        {isActive && (
                          <motion.span
                            className="flex items-center"
                            layoutId="header-menu-icon"
                          >
                            <Icon icon={item.icon} className="text-sm" />
                          </motion.span>
                        )}
                        <motion.span layout>{itemTitle}</motion.span>
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId="active-nav-item"
                          className="absolute inset-x-1 -bottom-px h-px bg-linear-to-r from-accent-500/0 via-accent-500/70 to-accent-500/0"
                        />
                      )}
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                );
              })}
            </NavigationMenu.List>

            {/* NavigationMenu dropdown portal */}
            <NavigationMenu.Portal>
              <NavigationMenu.Positioner
                className={styles.positioner}
                positionMethod="fixed"
                sideOffset={12}
              >
                <NavigationMenu.Popup
                  className={cn(
                    styles.popup,
                    styles.frostedPopup,
                    FROSTED_FILTER_CLASS,
                    "select-none rounded-2xl outline-hidden",
                  )}
                >
                  <NavigationMenu.Viewport className={styles.viewport} />
                </NavigationMenu.Popup>
              </NavigationMenu.Positioner>
            </NavigationMenu.Portal>
          </NavigationMenu.Root>
        </div>

        {/* Right-side actions */}
        <div className="flex flex-1 justify-end items-center gap-3 md:gap-2 pointer-events-none min-w-0">
          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                aria-label={t("nav.openSearch")}
                className={cn("pointer-events-auto", ACTION_BTN_CLASS, navAnimClass)}
              >
                <Icon icon="mingcute:search-2-line" className="text-lg md:text-xl" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={12}>{t("nav.search")}</TooltipContent>
          </Tooltip>

          <LanguageSwitch
            compact
            className={cn(
              "pointer-events-auto",
              styles.frostedControl,
              FROSTED_FILTER_CLASS,
              navAnimClass,
            )}
          />

          {/* Theme toggle */}
          <ThemeToggle className={cn("pointer-events-auto", ACTION_BTN_CLASS, navAnimClass)} iconClassName="text-lg md:text-xl" />
        </div>
      </div>
    </div>
  );
}
