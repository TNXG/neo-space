"use client";

import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { Icon } from "@/lib/inline-icon";

/**
 * Theme toggle button component
 * Cycles between light, dark, and system mode
 */
export function ThemeToggle() {
  const mounted = useHasMounted();
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return (
      <button
        type="button"
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer text-neutral-500 hover:text-accent-600 hover:bg-accent-500/10 active:scale-95 transition-all duration-200"
        aria-label="切换主题"
      >
        <Icon icon="mingcute:sun-line" className="text-lg sm:text-xl" />
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
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer text-neutral-500 hover:text-accent-600 hover:bg-accent-500/10 active:scale-95 transition-all duration-200"
          aria-label={`当前: ${themeConfig.label}`}
        >
          <Icon icon={themeConfig.icon} className="text-lg sm:text-xl" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={16}>{themeConfig.label}</TooltipContent>
    </Tooltip>
  );
}
