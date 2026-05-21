"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Icon } from "@/lib/inline-icon";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Checkbox 组件
 * - 方形设计
 * - Glassmorphism 风格
 * - 使用 accent 色系
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // 基础样式 - 方形
        "size-5 shrink-0 rounded-md border-2 transition-all duration-200 cursor-pointer",
        // 未选中状态 - Glassmorphism
        "border-border/60 bg-background/50 backdrop-blur-sm",
        // 选中状态 - accent 色系
        "data-[state=checked]:bg-accent-600 data-[state=checked]:border-accent-600",
        "data-[state=checked]:text-white",
        // Hover 状态
        "hover:border-accent-400",
        "data-[state=checked]:hover:bg-accent-500",
        // Focus 状态
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/50",
        // 无效状态
        "aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        // 禁用状态
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <Icon icon="mingcute:check-fill" className="w-3.5 h-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
