"use client";

import { useTranslations } from "next-intl";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";

/**
 * 404 页面 - 星海迷航版 (移动端优化)
 * 优化点：
 * 1. 调整了移动端 padding 和字体大小，防止内容溢出
 * 2. 移动端按钮组强制撑满宽度，便于单手点击
 * 3. 优化了光晕在小屏幕上的尺寸
 */
export default function NotFound() {
  const t = useTranslations();
  const mounted = useHasMounted();

  return (
    <div className="fixed inset-0 z-50 font-sans w-full flex items-center justify-center bg-background text-foreground overflow-hidden p-4 sm:p-6">
      {/* 背景氛围：深邃的星光感 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* 左上角 - 主色光晕 (移动端缩小尺寸) */}
        <div className="absolute top-0 left-0 w-70 h-70 sm:w-125 sm:h-125 bg-primary-200/30 rounded-full blur-[80px] sm:blur-[120px] -translate-x-1/3 -translate-y-1/3 mix-blend-multiply" />
        {/* 右下角 - 强调色光晕 (移动端缩小尺寸) */}
        <div className="absolute bottom-0 right-0 w-70 h-70 sm:w-125 sm:h-125 bg-accent-200/20 rounded-full blur-[80px] sm:blur-[120px] translate-x-1/4 translate-y-1/4 mix-blend-multiply" />
      </div>

      <main
        className={`glass-card relative w-full max-w-85 sm:max-w-130 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-[250ms] ease-out border border-white/20 shadow-glass flex flex-col ${
          mounted
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-8"
        }`}
      >
        {/* 顶部装饰线 */}
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-accent-400/50 to-transparent" />

        {/* 内容区域：移动端减少 padding */}
        <div className="flex flex-col items-center text-center px-5 py-8 sm:px-8 sm:py-10 grow justify-center">
          {/* 404 数字：移动端显著缩小，避免挤占空间 */}
          <div className="relative mb-6 sm:mb-8 select-none">
            <h1 className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-tighter leading-none text-primary-200/50 blur-[1px] transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm sm:text-xl font-mono text-accent-600/80 tracking-[0.3em] sm:tracking-[0.5em] uppercase translate-y-1">
                Not Found
              </span>
            </div>
          </div>

          {/* 核心文案区域 */}
          <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 w-full relative z-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1.5 tracking-tight">
                {t("notFound.title")}
              </h2>
              <p className="text-[10px] sm:text-xs font-medium tracking-[0.2em] sm:tracking-[0.3em] text-accent-600/70 uppercase font-mono">
                {t("notFound.eyebrow")}
              </p>
            </div>

            {/* 装饰分割点 */}
            <div className="flex justify-center gap-2 py-1 opacity-50">
              <span className="w-1 h-1 rounded-full bg-primary-400" />
              <span className="w-1 h-1 rounded-full bg-primary-400" />
              <span className="w-1 h-1 rounded-full bg-primary-400" />
            </div>

            {/* 文案：移动端限制宽度以增加可读性 */}
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-65 sm:max-w-none mx-auto">
              {t("notFound.description")}
            </p>
          </div>

          {/* 按钮组：移动端全宽 + 垂直排列，桌面端并排 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
            <Link
              href="/"
              className="group relative flex items-center justify-center gap-2 h-11 sm:h-12 px-6 sm:px-8 w-full sm:w-auto rounded-lg bg-accent-600 text-white font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200
              hover:bg-accent-700 active:scale-[0.98]
              cursor-pointer select-none text-sm sm:text-base"
            >
              <Icon icon="mingcute:home-3-line" className="w-4 h-4" />
              <span>{t("notFound.home")}</span>
            </Link>

            <button
              onClick={() => window.history.back()}
              type="button"
              className="group flex items-center justify-center gap-2 h-11 sm:h-12 px-6 sm:px-8 w-full sm:w-auto rounded-lg border border-border bg-transparent text-foreground font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200
              hover:bg-secondary hover:border-primary-300 hover:text-accent-700 active:scale-[0.98]
              cursor-pointer select-none text-sm sm:text-base"
            >
              <Icon icon="mingcute:arrow-left-line" className="w-4 h-4" />
              <span>{t("notFound.back")}</span>
            </button>
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className="h-9 sm:h-10 border-t border-border/50 bg-primary-50/50 flex items-center justify-between px-4 sm:px-6 text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0 rounded-b-lg">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </span>
            <span>{t("notFound.signalLost")}</span>
          </div>
          <div>ERR: 404</div>
        </div>
      </main>
    </div>
  );
}
