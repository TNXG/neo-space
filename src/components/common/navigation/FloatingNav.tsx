"use client";

import type { NavItem } from "./nav-config";
import type { User } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SearchPanel } from "@/components/common/search/SearchPanel";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useReaderSSE } from "@/hooks/use-reader-sse";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { NAV_ITEMS } from "./nav-config";

interface FloatingNavProps {
  user: User;
}

export function FloatingNav({ user }: FloatingNavProps) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const router = useRouter();
  const hasMounted = useHasMounted();

  // SSE 连接获取在线人数
  const { isConnected, onlineCount } = useReaderSSE();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Return to top states
  const [isSpinning, setIsSpinning] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    if (!hasMounted)
      return;

    const scrollY = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min(documentHeight > 0 ? (scrollY / documentHeight) * 100 : 0, 100);
    const isMobileView = window.innerWidth < 768;

    // 1. Back To Top Button
    setShowBackToTop((prev) => {
      const shouldShow = scrollY > 300;
      return prev !== shouldShow ? shouldShow : prev;
    });

    // 2. Reading Progress
    setReadingProgress(progress);

    // 3. Desktop Menu Auto-Expand (Only on Home & Top)
    if (!isMobileView) {
      if (isHomePage) {
        const shouldExpand = scrollY <= 100;
        setIsExpanded(shouldExpand || isHovering);
      } else {
        setIsExpanded(isHovering);
      }
    } else {
      // Mobile: keep collapsed, only open drawer on click
      setIsExpanded(false);
    }

    // 4. Animation State
    if (isSpinning) {
      setAnimationProgress(progress);
      if (scrollY < 10) {
        setIsSpinning(false);
        setAnimationProgress(0);
      }
    }
  }, [hasMounted, isHomePage, isSpinning, isHovering]);

  // Init & Listeners
  useEffect(() => {
    if (!hasMounted)
      return;

    // Fix: Wrap initial call in rAF to avoid synchronous setState warning
    requestAnimationFrame(() => handleScroll());

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMounted, handleScroll]);

  const handleCapsuleClick = () => {
    if (window.innerWidth < 768)
      setIsDrawerOpen(true);
  };

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
    if (window.scrollY > 100) {
      setIsSpinning(true);
      setAnimationProgress(readingProgress);
    }
    scrollToTop();
  }, [scrollToTop, readingProgress]);

  // Safety timer
  useEffect(() => {
    if (isSpinning) {
      const t = setTimeout(() => setIsSpinning(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isSpinning]);

  return (
    <>
      <MobileNavDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />

      {/* Mobile: Both capsules at bottom center side by side */}
      <div className="md:hidden flex gap-3 pointer-events-none bottom-4 left-0 right-0 justify-center fixed z-50 px-4">
        {/* Left Capsule */}
        <div
          className="glass-nav rounded-full flex h-12 pointer-events-auto items-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer active:scale-95"
          onClick={handleCapsuleClick}
        >
          <div className="px-1 flex items-center h-full">
            {/* User Info */}
            <div className="flex items-center gap-3 px-2 shrink-0">
              <div className="relative shrink-0">
                {/* Pulse rings - online status indicator */}
                <div className="absolute inset-0">
                  <div className="absolute -inset-0.75 rounded-full border-2 border-accent-500 animate-pulse-ring" />
                  <div className="absolute -inset-0.75 rounded-full border-2 border-accent-500 animate-pulse-ring-delayed" />
                </div>
                {user.avatar
                  ? (
                      <img src={user.avatar} alt={user.name} className="relative z-10 rounded-full h-8 w-8 object-cover bg-neutral-100" />
                    )
                  : (
                      <div className="relative z-10 text-neutral-600 font-bold rounded-full flex h-8 w-8 items-center justify-center bg-neutral-200">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-primary-900 text-xs font-bold whitespace-nowrap truncate max-w-30">
                  {user.name}
                </span>
                <span className="text-accent-600 text-[10px] flex gap-1 whitespace-nowrap items-center leading-none mt-0.5">
                  <Icon icon="mingcute:sparkles-line" className="text-[9px]" />
                  {isConnected ? `在线 · ${onlineCount}` : "离线"}
                </span>
              </div>
            </div>

            {/* Mobile Hint */}
            <div className="flex pr-3 pl-1 items-center animate-in fade-in zoom-in duration-300">
              <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700/50 mr-3" />
              <Icon icon="mingcute:up-small-line" className="text-neutral-400 text-lg animate-bounce-custom" />
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-nav rounded-full flex h-12 pointer-events-auto items-center shrink-0"
        >
          <AnimatePresence>
            {showBackToTop && (
              <motion.div
                initial={{ width: 0, opacity: 0, scale: 0.8 }}
                animate={{ width: "auto", opacity: 1, scale: 1 }}
                exit={{ width: 0, opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pl-2 pr-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleScrollToTopAction}
                        className="w-9 h-9 rounded-full flex items-center justify-center relative text-neutral-600 hover:bg-accent-100 transition-colors cursor-pointer"
                      >
                        <svg className="absolute inset-0 w-full h-full p-0.5" viewBox="0 0 36 36">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-200 dark:text-neutral-700" />
                          <motion.path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="var(--accent-500)"
                            strokeWidth="2"
                            strokeDasharray="100, 100"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: (isSpinning ? animationProgress : readingProgress) / 100 }}
                          />
                        </svg>
                        {isSpinning
                          ? (
                              <Icon icon="mingcute:loading-line" className="text-lg animate-spin" />
                            )
                          : (
                              <Icon icon="mingcute:arrow-up-line" className="text-lg" />
                            )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">返回顶部</TooltipContent>
                  </Tooltip>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={showBackToTop ? "px-1" : "pl-2 pr-1"}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 hover:bg-accent-100 transition-colors cursor-pointer"
                >
                  <Icon icon="mingcute:search-2-line" className="text-lg" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">搜索</TooltipContent>
            </Tooltip>
          </div>

          <div className="px-2">
            <ThemeToggle />
          </div>
        </motion.div>
      </div>

      {/* Desktop: Left capsule at top-left, Right actions at bottom-right */}
      <div className="hidden md:block">
        {/* Left Capsule - Desktop: top-left */}
        <div className="pointer-events-none top-4 left-4 fixed z-50 px-4">
          <div
            className="glass-nav rounded-full flex h-14 pointer-events-auto items-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            onMouseEnter={() => {
              if (window.innerWidth >= 768) {
                setIsHovering(true);
              }
            }}
            onMouseLeave={() => {
              if (window.innerWidth >= 768) {
                setIsHovering(false);
              }
            }}
          >
            <div className="px-1 flex items-center h-full">
              {/* User Info */}
              <div className="flex items-center gap-3 px-3 shrink-0">
                <div className="relative shrink-0">
                  {/* Pulse rings - online status indicator */}
                  <div className="absolute inset-0">
                    <div className="absolute -inset-0.75 rounded-full border-2 border-accent-500 animate-pulse-ring" />
                    <div className="absolute -inset-0.75 rounded-full border-2 border-accent-500 animate-pulse-ring-delayed" />
                  </div>
                  {user.avatar
                    ? (
                        <img src={user.avatar} alt={user.name} className="relative z-10 rounded-full h-8 w-8 object-cover bg-neutral-100" />
                      )
                    : (
                        <div className="relative z-10 text-neutral-600 font-bold rounded-full flex h-8 w-8 items-center justify-center bg-neutral-200">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-primary-900 text-sm font-bold whitespace-nowrap truncate max-w-37.5">
                    {user.name}
                  </span>
                  <span className="text-accent-600 text-[10px] flex gap-1 whitespace-nowrap items-center leading-none mt-0.5">
                    <Icon icon="mingcute:sparkles-line" className="text-[9px]" />
                    {isConnected ? `在线 · ${onlineCount}` : "离线"}
                  </span>
                </div>
              </div>

              {/* Desktop Menu */}
              <div className="flex items-center overflow-hidden">
                {/* Fixed Divider */}
                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1 shrink-0" />

                <div className="relative flex items-center overflow-hidden">
                  {/* Expand Hint Arrow - Show when collapsed */}
                  <AnimatePresence>
                    {!isExpanded && hasMounted && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center pr-2">
                          <Icon
                            icon="mingcute:right-line"
                            className="text-neutral-400 text-base animate-pulse"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Navigation Items - Show when expanded */}
                  <motion.div
                    initial={false}
                    animate={{
                      width: (isExpanded && hasMounted) ? "auto" : 0,
                      opacity: (isExpanded && hasMounted) ? 1 : 0,
                    }}
                    transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    className="flex items-center overflow-hidden"
                  >
                    <div className="flex items-center gap-1 pr-2 whitespace-nowrap">
                      {NAV_ITEMS.map(item => (
                        <Tooltip key={item.id}>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              onClick={e => handleNavClick(e, item)}
                              className="p-2 rounded-full text-neutral-500 hover:text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors"
                            >
                              <Icon icon={item.icon} className="text-lg" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">{item.title}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Actions - Desktop: bottom-right */}
        <div className="pointer-events-none bottom-8 right-4 fixed z-50 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-nav rounded-full flex h-14 pointer-events-auto items-center shrink-0"
          >
            <AnimatePresence>
              {showBackToTop && (
                <motion.div
                  initial={{ width: 0, opacity: 0, scale: 0.8 }}
                  animate={{ width: "auto", opacity: 1, scale: 1 }}
                  exit={{ width: 0, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pl-2 pr-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleScrollToTopAction}
                          className="w-10 h-10 rounded-full flex items-center justify-center relative text-neutral-600 hover:bg-accent-100 transition-colors cursor-pointer"
                        >
                          <svg className="absolute inset-0 w-full h-full p-0.5" viewBox="0 0 36 36">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-200 dark:text-neutral-700" />
                            <motion.path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="var(--accent-500)"
                              strokeWidth="2"
                              strokeDasharray="100, 100"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: (isSpinning ? animationProgress : readingProgress) / 100 }}
                            />
                          </svg>
                          {isSpinning
                            ? (
                                <Icon icon="mingcute:loading-line" className="text-lg animate-spin" />
                              )
                            : (
                                <Icon icon="mingcute:arrow-up-line" className="text-lg" />
                              )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">返回顶部</TooltipContent>
                    </Tooltip>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={showBackToTop ? "px-1" : "pl-3 pr-1"}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-600 hover:bg-accent-100 transition-colors cursor-pointer"
                  >
                    <Icon icon="mingcute:search-2-line" className="text-lg" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">搜索</TooltipContent>
              </Tooltip>
            </div>

            <div className="px-3">
              <ThemeToggle />
            </div>
          </motion.div>
        </div>
      </div>

      {/* 全局搜索面板 */}
      <AnimatePresence>
        <SearchPanel open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      </AnimatePresence>
    </>
  );
}
