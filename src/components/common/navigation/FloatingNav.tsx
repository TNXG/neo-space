"use client";

import type { NavItem } from "./nav-config";
import type { User } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchPanel } from "@/components/common/search/SearchPanel";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useReaderSSE } from "@/hooks/use-reader-sse";
import { cn } from "@/lib/utils";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { NAV_ITEMS } from "./nav-config";

const ACTION_BTN_CLASS = cn(
  "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center cursor-pointer",
  "text-neutral-500 hover:text-accent-600 hover:bg-accent-500/10",
  "active:scale-95 transition-all duration-200",
);

interface FloatingNavProps {
  user: User;
}

export function FloatingNav({ user }: FloatingNavProps) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const router = useRouter();
  const hasMounted = useHasMounted();
  const { isConnected, onlineCount } = useReaderSSE();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);

  // 所有滚动相关 ref 合并为单个对象
  const scroll = useRef({
    lastY: 0,
    downAccum: 0,
    upAccum: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    backToTopAnimating: false,
    backToTopReady: false,
    backToTopReadyTime: 0,
    backToTopHideTimer: null as ReturnType<typeof setTimeout> | null,
    showBackToTop: false,
  }).current;

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    if (!hasMounted)
      return;

    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min(docHeight > 0 ? (scrollY / docHeight) * 100 : 0, 100);
    const shouldShow = scrollY > 300;

    if (scroll.showBackToTop !== shouldShow) {
      scroll.showBackToTop = shouldShow;
      if (!shouldShow)
        scroll.backToTopReady = false;
      setShowBackToTop(shouldShow);
    }

    setReadingProgress(progress);

    // 滚动方向检测
    const delta = scrollY - scroll.lastY;
    if (delta > 0) {
      scroll.downAccum += delta;
      scroll.upAccum = 0;
    } else if (delta < 0) {
      scroll.upAccum += Math.abs(delta);
      scroll.downAccum = 0;
    }

    if (scrollY < 100) {
      setIsNavVisible(true);
      scroll.downAccum = 0;
      scroll.upAccum = 0;
    } else if (scroll.downAccum > 180) {
      const canHide = !scroll.showBackToTop
        || (scroll.backToTopReady
          && !scroll.backToTopAnimating
          && Date.now() - scroll.backToTopReadyTime > 1500);
      if (canHide) {
        setIsNavVisible(false);
        scroll.downAccum = 0;
      }
    } else if (scroll.upAccum > 40) {
      setIsNavVisible(true);
      scroll.upAccum = 0;
    }

    scroll.lastY = scrollY;

    // 停止滚动后自动显示
    if (scroll.timer)
      clearTimeout(scroll.timer);
    scroll.timer = setTimeout(() => setIsNavVisible(true), 2500);

    if (isSpinning && scrollY < 10) {
      setIsSpinning(false);
    }
  }, [hasMounted, isSpinning, scroll]);

  useEffect(() => {
    if (!hasMounted)
      return;
    requestAnimationFrame(() => handleScroll());
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMounted, handleScroll]);

  // 旋转超时自动停止
  useEffect(() => {
    if (!isSpinning)
      return;
    const t = setTimeout(() => setIsSpinning(false), 3000);
    return () => clearTimeout(t);
  }, [isSpinning]);

  const handleNavClick = useCallback((e: React.MouseEvent, item: NavItem) => {
    if (item.id === "home") {
      e.preventDefault();
      isHomePage ? scrollToTop() : router.push("/");
      return;
    }
    if (item.href.startsWith("/#") && isHomePage) {
      e.preventDefault();
      document.querySelector(item.href.slice(1))?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isHomePage, router, scrollToTop]);

  const handleScrollToTopAction = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    if (window.scrollY > 100)
      setIsSpinning(true);
    scrollToTop();
  }, [scrollToTop]);

  return (
    <>
      <MobileNavDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />

      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <AnimatePresence>
          {hasMounted && (
            <motion.nav
              initial={{ y: 100, opacity: 0, scale: 0.9 }}
              animate={{
                y: isNavVisible ? 0 : 64,
                opacity: isNavVisible ? 1 : 0.6,
                scale: isNavVisible ? 1 : 0.8,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              onHoverStart={() => setIsNavVisible(true)}
              onClick={() => !isNavVisible && setIsNavVisible(true)}
              className={cn(
                "pointer-events-auto flex items-center relative",
                "h-14 sm:h-16 rounded-full glass-nav",
                !isNavVisible && "cursor-pointer hover:opacity-100",
              )}
            >
              {/* 1. 左侧头像 & 移动端触发 */}
              <div
                className={cn(
                  "flex items-center gap-3 px-3 h-full cursor-pointer sm:cursor-default rounded-l-full sm:rounded-none sm:pl-4",
                  "hover:bg-accent-500/5 transition-colors sm:hover:bg-transparent",
                )}
                onClick={() => {
                  if (window.innerWidth < 640)
                    setIsDrawerOpen(true);
                }}
              >
                <div className="relative shrink-0 flex items-center">
                  <div className="absolute -inset-1 rounded-full border-2 border-accent-500/30 animate-pulse-ring" />
                  {user.avatar
                    ? (
                        <img src={user.avatar} alt={user.name} className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover bg-neutral-100" />
                      )
                    : (
                        <div className="relative z-10 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full font-bold text-neutral-600 bg-neutral-200">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                </div>
                <div className="flex flex-col justify-center max-w-20 sm:max-w-25">
                  <span className="text-sm font-bold text-neutral-800 truncate">{user.name}</span>
                  <span className="text-[10px] sm:text-xs flex items-center gap-1 text-accent-600font-medium">
                    <Icon icon="mingcute:sparkles-line" className="text-[10px]" />
                    {isConnected ? `在线·${onlineCount}` : "离线"}
                  </span>
                </div>

                <div className="sm:hidden flex items-center text-neutral-400 pl-1">
                  <Icon icon="mingcute:menu-line" className="text-xl" />
                </div>
              </div>

              <div className="hidden sm:block w-px h-6 bg-neutral-200/60 mx-2" />

              {/* 2. 中间导航 (仅桌面) */}
              <div className="hidden sm:flex items-center h-full px-1 gap-0.5">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.href === "/" ? isHomePage : pathname.startsWith(item.href);
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          onClick={e => handleNavClick(e, item)}
                          className={cn(
                            "relative flex items-center justify-center w-11 h-11 rounded-full cursor-pointer active:scale-95 transition-all duration-200",
                            isActive
                              ? "text-accent-600 bg-accent-500/10"
                              : "text-neutral-500 hover:text-accent-600 hover:bg-accent-500/10",
                          )}
                        >
                          <Icon icon={item.icon} className="text-xl relative z-10" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={16} className="text-xs font-medium">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="hidden sm:block w-px h-6 bg-neutral-200/60 mx-2" />

              {/* 3. 右侧操作 */}
              <div className="flex items-center h-full pr-2pl-1 sm:px-2 gap-0.5">
                <AnimatePresence>
                  {showBackToTop && (
                    <motion.div
                      variants={{
                        hidden: { width: 0, opacity: 0 },
                        visible: { width: "auto", opacity: 1 },
                      }}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden flex items-center"
                      onAnimationStart={(variant) => {
                        scroll.backToTopAnimating = true;
                        if (variant === "hidden")
                          scroll.backToTopReady = false;
                      }}
                      onAnimationComplete={(variant) => {
                        scroll.backToTopAnimating = false;
                        if (variant === "visible") {
                          scroll.backToTopReady = true;
                          scroll.backToTopReadyTime = Date.now();

                          if (scroll.downAccum > 180) {
                            if (scroll.backToTopHideTimer)
                              clearTimeout(scroll.backToTopHideTimer);
                            scroll.backToTopHideTimer = setTimeout(() => {
                              if (scroll.downAccum > 180) {
                                setIsNavVisible(false);
                                scroll.downAccum = 0;
                              }
                            }, 1500);
                          }
                        }
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={handleScrollToTopAction} className={cn(ACTION_BTN_CLASS, "relative")}>
                            <svg className="absolute inset-0 w-full h-full p-1" viewBox="0 0 36 36">
                              <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-200" />
                              <motion.path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="var(--accent-500)"
                                strokeWidth="2"
                                strokeDasharray="100, 100"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: readingProgress / 100 }}
                              />
                            </svg>
                            {isSpinning
                              ? <Icon icon="mingcute:loading-line" className="text-lg sm:text-xl animate-spin" />
                              : <Icon icon="mingcute:arrow-up-line" className="text-lg sm:text-xl" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={16}>返回顶部</TooltipContent>
                      </Tooltip>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => setIsSearchOpen(true)} className={ACTION_BTN_CLASS}>
                      <Icon icon="mingcute:search-2-line" className="text-lg sm:text-xl" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={16}>搜索</TooltipContent>
                </Tooltip>

                <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11">
                  <ThemeToggle />
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        <SearchPanel open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      </AnimatePresence>
    </>
  );
}
