"use client";

import type { AppLocale } from "@/locales";

import { useLocale, useTranslations } from "next-intl";
import { startTransition, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { routing } from "@/locales";
import { usePathname, useRouter } from "@/locales/navigation";

interface LanguageSwitchProps {
  className?: string;
  /** 紧凑下拉样式，用于桌面顶栏 */
  compact?: boolean;
  /** 行内分段样式，用于移动端抽屉，与导航项视觉语言保持一致 */
  inline?: boolean;
  onLocaleChange?: () => void;
  tooltipSideOffset?: number;
}

export function LanguageSwitch({
  className,
  compact = false,
  inline = false,
  onLocaleChange,
  tooltipSideOffset = 12,
}: LanguageSwitchProps) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const localeOptions = [...routing.locales] as AppLocale[];

  const handleLocaleChange = (nextLocale: AppLocale) => {
    if (nextLocale === locale) {
      return;
    }

    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
      router.refresh();
    });

    setOpen(false);
    onLocaleChange?.();
  };

  if (inline) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 rounded-2xl p-3 transition-colors duration-200",
          className,
        )}
        role="group"
        aria-label={t("nav.language")}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground">
          <Icon icon="mingcute:translate-2-line" className="h-5 w-5" />
        </div>
        <span className="text-base font-medium text-foreground">{t("nav.language")}</span>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-secondary/50 p-1">
          {localeOptions.map((option) => {
            const isActive = option === locale;

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleLocaleChange(option)}
                aria-pressed={isActive}
                className={cn(
                  "h-7 cursor-pointer rounded-full px-2.5 text-xs font-semibold transition-colors duration-200",
                  isActive
                    ? "bg-accent-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 cursor-pointer",
                  "bg-popover/60 backdrop-blur-md shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-900/5",
                  "text-neutral-600 hover:text-accent-600 hover:bg-background/90",
                  "active:scale-95 will-change-transform duration-200!",
                  className,
                )}
                aria-label={t("nav.language")}
              >
                <Icon icon="mingcute:translate-2-line" className="text-lg md:text-xl" />
                <span className="text-sm font-medium leading-none">{locale.toUpperCase()}</span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={tooltipSideOffset}>
            {t("nav.language")}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" sideOffset={12} className="w-52">
          <DropdownMenuLabel>
            <div className="text-sm font-medium text-foreground">{t("nav.language")}</div>
            <div className="text-xs font-normal text-muted-foreground">{t(`nav.localeName.${locale}`)}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {localeOptions.map((option) => {
            const isActive = option === locale;

            return (
              <DropdownMenuItem
                key={option}
                onClick={() => handleLocaleChange(option)}
                className="flex items-center justify-between"
              >
                <span>{t(`nav.localeName.${option}`)}</span>
                {isActive && <Icon icon="mingcute:check-line" className="text-base text-accent-600" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{t("nav.language")}</span>
        <span className="text-xs text-muted-foreground">{t(`nav.localeName.${locale}`)}</span>
      </div>

      <div className="space-y-2" role="group" aria-label={t("nav.language")}>
        {localeOptions.map((option) => {
          const isActive = option === locale;

          return (
            <button
              key={option}
              type="button"
              onClick={() => handleLocaleChange(option)}
              aria-pressed={isActive}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200",
                isActive
                  ? "border-accent-500 bg-accent-50 text-accent-900"
                  : "border-border/70 bg-background/70 text-foreground hover:border-accent-300 hover:bg-accent-50/60",
              )}
            >
              <span>{t(`nav.localeName.${option}`)}</span>
              {isActive && <Icon icon="mingcute:check-line" className="text-base text-accent-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
