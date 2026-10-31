import type { ReactNode } from "react";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

// 抖音美好体仅保留 0–9；OFL 要求子集重命名，授权随字体保存在 assets/fonts。
const archiveNumerals = localFont({
  src: "../../assets/fonts/archive-numerals.ttf",
  variable: "--font-archive-numerals",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["Arial", "sans-serif"],
});

interface ArchiveTitleProps {
  year: string;
  children?: ReactNode;
  className?: string;
}

/**
 * 融合 Zhilu archive-title 的描边年份与底部渐隐，使用本站语义色。
 * @param props 年份、右侧辅助信息与容器布局
 * @returns 可复用的归档分组标题
 */
export function ArchiveTitle({ year, children, className }: ArchiveTitleProps) {
  return (
    <div className={cn(archiveNumerals.variable, "archive-title group/archive-title relative flex min-w-0 items-start justify-between gap-4", className)}>
      <h3 className="archive-year mb-[-0.3em] shrink-0 mask-[linear-gradient(to_bottom,black_50%,transparent)] px-1 py-1 font-(family-name:--font-archive-numerals) text-[clamp(3rem,5vw,4.5rem)] leading-[1.1] font-extrabold tracking-normal text-transparent tabular-nums opacity-40 [-webkit-text-stroke:1px_var(--muted-foreground)] transition-colors duration-200 group-[:hover]/archive-title:text-muted-foreground group-[:hover]/archive:text-muted-foreground">
        {year}
      </h3>
      {children && <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 pt-2 text-xs leading-relaxed text-muted-foreground tabular-nums">{children}</div>}
    </div>
  );
}
