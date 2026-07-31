"use client";

import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { Icon } from "@/lib/inline-icon";

import { cn } from "@/lib/utils";

/**
 * Theme toggle button component
 * Cycles between light, dark, and system mode
 */
export function ThemeToggle({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const mounted = useHasMounted();
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer text-neutral-500 hover:text-accent-600 hover:bg-accent-500/10 active:scale-95 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200", className)}
        aria-label="切换主题"
      >
        <Icon icon="mingcute:sun-line" className={cn("text-lg sm:text-lg", iconClassName)} />
      </button>
    );
  }

  const getThemeConfig = (currentTheme: string | undefined) => {
    switch (currentTheme) {
      case "light":
        return {
          icon: "mingcute:sun-line",
          label: "亮色模式",
          next: "dark",
        };
      case "dark":
        return {
          icon: "mingcute:moon-line",
          label: "暗色模式",
          next: "system",
        };
      case "system":
      default:
        return {
          icon: "mingcute:computer-line",
          label: "跟随系统",
          next: "light",
        };
    }
  };

  const themeConfig = getThemeConfig(theme);

  const toggleTheme = () => {
    setTheme(themeConfig.next);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggleTheme}
          className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer text-neutral-500 hover:text-accent-600 hover:bg-accent-500/10 active:scale-95 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200", className)}
          aria-label={`当前: ${themeConfig.label}`}
        >
          <Icon icon={themeConfig.icon} className={cn("text-lg sm:text-lg", iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={12}>{themeConfig.label}</TooltipContent>
    </Tooltip>
  );
}
