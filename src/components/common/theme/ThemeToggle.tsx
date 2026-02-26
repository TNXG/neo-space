"use client";

import type { ComponentType, SVGProps } from "react";
import { useTheme } from "next-themes";

import ComputerLine from "~icons/mingcute/computer-line";
import MoonLine from "~icons/mingcute/moon-line";
import SunLine from "~icons/mingcute/sun-line";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasMounted } from "@/hooks/use-has-mounted";

interface ThemeConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  next: "light" | "dark" | "system";
}

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
        className="p-2 rounded-full shrink-0 transition-colors duration-200 text-neutral-600"
        aria-label="切换主题"
      >
        <SunLine className="text-[18px]" />
      </button>
    );
  }

  const getThemeConfig = (currentTheme: string | undefined): ThemeConfig => {
    switch (currentTheme) {
      case "light":
        return {
          icon: SunLine,
          label: "亮色模式",
          next: "dark",
        };
      case "dark":
        return {
          icon: MoonLine,
          label: "暗色模式",
          next: "system",
        };
      case "system":
      default:
        return {
          icon: ComputerLine,
          label: "跟随系统",
          next: "light",
        };
    }
  };

  const themeConfig = getThemeConfig(theme);
  const IconComponent = themeConfig.icon;

  const toggleTheme = () => {
    setTheme(themeConfig.next);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-full shrink-0 cursor-pointer transition-colors duration-200 hover:bg-accent-100 text-neutral-600"
          aria-label={`当前: ${themeConfig.label}`}
        >
          <IconComponent className="text-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{themeConfig.label}</TooltipContent>
    </Tooltip>
  );
}
