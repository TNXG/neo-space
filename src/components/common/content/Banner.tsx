"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import AlertTriangleLine from "~icons/mingcute/alert-line";
import CheckCircleLine from "~icons/mingcute/check-circle-line";
import CloseCircleLine from "~icons/mingcute/close-circle-line";
import InformationLine from "~icons/mingcute/information-line";

interface BannerProps {
  type: "info" | "success" | "warn" | "error";
  children: ReactNode;
  className?: string;
}

const bannerStyles = {
  info: {
    container: "bg-blue-50/80 border-blue-200",
    iconColor: "text-blue-600",
    Icon: InformationLine,
  },
  success: {
    container: "bg-green-50/80 border-green-200",
    iconColor: "text-green-600",
    Icon: CheckCircleLine,
  },
  warn: {
    container: "bg-yellow-50/80 border-yellow-200",
    iconColor: "text-yellow-600",
    Icon: AlertTriangleLine,
  },
  error: {
    container: "bg-red-50/80 border-red-200",
    iconColor: "text-red-600",
    Icon: CloseCircleLine,
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
        <style.Icon className={clsx("w-5 h-5", style.iconColor)} />
      </div>
      <div className="flex-1 min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
