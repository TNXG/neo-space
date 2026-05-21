import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button 变体配置
 * - 胶囊形圆角 (rounded-xl)
 * - 交互元素强制 cursor-pointer
 * - 禁用状态 cursor-not-allowed + 50% 透明度
 */
const buttonVariants = cva(
  [
    // 基础布局
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    // 胶囊形圆角
    "rounded-xl",
    // 字体
    "text-sm font-medium",
    // 过渡动画 (300ms)
    "transition-all duration-300",
    // 交互指针
    "cursor-pointer",
    // 禁用状态
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    // SVG 图标处理
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "shrink-0",
    // Focus 样式
    "outline-none focus-visible:ring-2 focus-visible:ring-accent-400/50",
    // 无效状态
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        // 主按钮 - 青绿强调色
        default: [
          "bg-accent-600 text-white",
          "hover:bg-accent-500 hover:shadow-lg hover:shadow-accent-500/25",
          "active:scale-95",
        ].join(" "),
        // 破坏性操作
        destructive: [
          "bg-destructive text-white",
          "hover:bg-destructive/90",
          "focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
          "dark:bg-destructive/60",
        ].join(" "),
        // 边框按钮 - Glassmorphism
        outline: [
          "border border-border/50 bg-background/50 backdrop-blur-sm",
          "hover:bg-secondary hover:border-border",
          "shadow-sm",
        ].join(" "),
        // 次要按钮
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/80",
        ].join(" "),
        // 幽灵按钮
        ghost: [
          "hover:bg-secondary hover:text-foreground",
          "dark:hover:bg-secondary/50",
        ].join(" "),
        // 链接样式
        link: [
          "text-accent-600 underline-offset-4",
          "hover:underline hover:text-accent-500",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-8 px-4 gap-1.5 has-[>svg]:px-3",
        lg: "h-12 px-8 text-base has-[>svg]:px-6",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
