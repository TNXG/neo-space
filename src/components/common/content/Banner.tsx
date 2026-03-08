"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Icon } from "@/lib/inline-icon";

interface BannerProps {
  type: "info" | "success" | "warn" | "error";
  children: ReactNode;
  className?: string;
}

const bannerStyles = {
  info: {
    container: "bg-blue-50/80 border-blue-200",
    icon: "text-blue-600",
    iconName: "mingcute:information-line",
  },
  success: {
    container: "bg-green-50/80 border-green-200",
    icon: "text-green-600",
    iconName: "mingcute:check-circle-line",
  },
  warn: {
    container: "bg-yellow-50/80 border-yellow-200",
    icon: "text-yellow-600",
    iconName: "mingcute:alert-triangle-line",
  },
  error: {
    container: "bg-red-50/80 border-red-200",
    icon: "text-red-600",
    iconName: "mingcute:close-circle-line",
  },
};

/**
 * Banner 组件 - 用于显示提示、警告、错误等信息
 */
export function Banner({ type, children, className }: BannerProps) {
  const style = bannerStyles[type];

  return (
    <div
      className={clsx(
        "relative my-6 rounded-2xl border-2 backdrop-blur-sm p-4 flex gap-3",
        style.container,
        className,
      )}
    >
      <div className="shrink-0 mt-0.5">
        <Icon
          icon={style.iconName}
          className={clsx("w-5 h-5", style.icon)}
        />
      </div>
      <div className="flex-1 min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
