"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { Icon } from "@/lib/inline-icon"

import { cn } from "@/lib/utils"

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

/**
 * 遮罩层 - Glassmorphism 风格
 */
function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "transition-all duration-300",
        className
      )}
      {...props}
    />
  )
}

/**
 * 内容容器 - Glassmorphism 风格，大圆角
 * - 上/下方向: rounded-3xl 圆角
 * - 左/右方向: 仅圆角对侧边缘
 * - 玻璃拟态背景 + 边框 + 阴影
 */
function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col outline-none",
          // Glassmorphism 风格
          "bg-background/95 backdrop-blur-xl border border-border/40 shadow-2xl",
          // 上方向 Drawer
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0",
          "data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh]",
          "data-[vaul-drawer-direction=top]:rounded-b-3xl data-[vaul-drawer-direction=top]:border-b",
          // 下方向 Drawer
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0",
          "data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh]",
          "data-[vaul-drawer-direction=bottom]:rounded-t-3xl data-[vaul-drawer-direction=bottom]:border-t",
          // 右方向 Drawer
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0",
          "data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l",
          "data-[vaul-drawer-direction=right]:rounded-l-3xl data-[vaul-drawer-direction=right]:sm:max-w-sm",
          // 左方向 Drawer
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0",
          "data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r",
          "data-[vaul-drawer-direction=left]:rounded-r-3xl data-[vaul-drawer-direction=left]:sm:max-w-sm",
          // 动画效果
          "transition-all duration-300",
          className
        )}
        {...props}
      >
        {/* 拖拽指示器 - 仅在底部方向显示，使用 muted 颜色 */}
        <div className="mx-auto mt-4 hidden h-1.5 w-20 shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        
        {children}

        {/* 关闭按钮 - 仅在左/右侧边栏模式显示 */}
        <DrawerPrimitive.Close
          className={cn(
            "absolute top-4 right-4 p-2 rounded-full cursor-pointer z-50",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-secondary transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-accent-400/50",
            "disabled:pointer-events-none",
            "hidden group-data-[vaul-drawer-direction=right]/drawer-content:block group-data-[vaul-drawer-direction=left]/drawer-content:block"
          )}
        >
          <Icon icon="mingcute:close-line" className="w-5 h-5" />
          <span className="sr-only">关闭</span>
        </DrawerPrimitive.Close>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

/**
 * Header 区域 - 统一内边距和间距，带底部边框
 */
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-1.5 px-6 pt-6 pb-4 border-b border-border/40",
        "group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center",
        "group-data-[vaul-drawer-direction=top]/drawer-content:text-center",
        className
      )}
      {...props}
    />
  )
}

/**
 * Footer 区域 - 统一内边距和间距，带顶部边框和背景
 */
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 px-6 py-4",
        "border-t border-border/40 bg-secondary/20",
        className
      )}
      {...props}
    />
  )
}

/**
 * Title - 使用项目字体层级
 */
function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "text-lg font-bold leading-none tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * Description - 次要文本样式
 */
function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/**
 * 内容主体区域 - 可滚动
 */
function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-body"
      className={cn(
        "flex-1 overflow-y-auto px-6 py-4 scrollbar-hide",
        className
      )}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
}
