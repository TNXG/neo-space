import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Skeleton 骨架屏组件
 * - 使用 stone 暖灰色阶与站点配色保持一致
 * - animate-pulse 脉冲动画提示加载状态
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-primary-200/70 animate-pulse rounded-md",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
