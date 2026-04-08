"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

const FAB_BTN_CLASS = cn(
  "w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center cursor-pointer",
  "bg-background/80 backdrop-blur-lg shadow-lg shadow-neutral-900/5 border border-border/50",
  "text-neutral-600 hover:text-accent-600 hover:bg-background/90",
  "active:scale-95 transition-all duration-200 outline-none focus:outline-none",
);

interface BackToTopFabProps {
  readingProgress: number;
  scrollToTop: () => void;
}

export function BackToTopFab({ readingProgress, scrollToTop }: BackToTopFabProps) {
  const t = useTranslations();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleScrollToTopAction = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    if (window.scrollY > 100)
      setIsSpinning(true);
    scrollToTop();
  }, [scrollToTop]);

  useEffect(() => {
    if (!isSpinning)
      return;
    const t = setTimeout(setIsSpinning, 3000, false);
    return () => clearTimeout(t);
  }, [isSpinning]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-6 right-6 z-50 pointer-events-auto flex flex-col gap-3"
        initial={{ opacity: 0, y: 20, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleScrollToTopAction}
              aria-label={t("nav.backToTop")}
              className={cn(FAB_BTN_CLASS, "relative")}
            >
              <svg className="absolute inset-0 w-full h-full p-0.5" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-neutral-200 dark:text-neutral-800"
                />
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
              <div className="relative z-10">
                {isSpinning
                  ? (
                      <Icon icon="mingcute:loading-line" className="text-xl animate-spin" />
                    )
                  : (
                      <Icon icon="mingcute:arrow-up-line" className="text-xl" />
                    )}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={12}>{t("nav.backToTop")}</TooltipContent>
        </Tooltip>
      </motion.div>
    </AnimatePresence>
  );
}
