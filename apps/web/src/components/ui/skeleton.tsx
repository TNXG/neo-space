import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Skeleton 骨架屏组件
 * - 使用前景色低透明度，在内容区和侧栏背景上均保持可见
 * - animate-pulse 脉冲动画提示加载状态
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-foreground/10 animate-pulse rounded-md motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
