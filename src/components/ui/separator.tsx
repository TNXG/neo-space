"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Separator - 实线分隔线
// -----------------------------------------------------------------------------

interface SeparatorProps
  extends React.ComponentProps<typeof SeparatorPrimitive.Root> {
  /** 分隔线变体 */
  variant?: "solid" | "dashed";
}

/**
 * 分隔线组件
 * - solid: 实线 (默认)，使用 border/40 透明度
 * - dashed: 虚线，居中显示，宽度 50%
 */
function Separator({
  className,
  orientation = "horizontal",
  variant = "solid",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      data-variant={variant}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0",
        // 实线样式
        variant === "solid" && [
          "bg-border/40",
          "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        ],
        // 虚线样式 (markdown hr 风格)
        variant === "dashed" && [
          "bg-transparent border-0",
          "data-[orientation=horizontal]:h-0 data-[orientation=horizontal]:w-1/2 data-[orientation=horizontal]:mx-auto",
          "data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-dashed data-[orientation=horizontal]:border-primary-200",
          "data-[orientation=vertical]:w-0 data-[orientation=vertical]:h-1/2 data-[orientation=vertical]:my-auto",
          "data-[orientation=vertical]:border-l data-[orientation=vertical]:border-dashed data-[orientation=vertical]:border-primary-200",
        ],
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// DashedSeparator - 虚线分隔线快捷组件
// -----------------------------------------------------------------------------

interface DashedSeparatorProps
  extends Omit<SeparatorProps, "variant"> {
  /** 垂直间距 */
  spacing?: "sm" | "md" | "lg";
}

/**
 * 虚线分隔线 - 用于 markdown hr 等场景
 * - 居中显示，宽度 50%
 * - 支持不同间距
 */
function DashedSeparator({
  className,
  spacing = "md",
  ...props
}: DashedSeparatorProps) {
  return (
    <Separator
      variant="dashed"
      className={cn(
        spacing === "sm" && "my-4",
        spacing === "md" && "my-8 md:my-10",
        spacing === "lg" && "my-10 md:my-12",
        className
      )}
      {...props}
    />
  );
}

export { DashedSeparator, Separator };
