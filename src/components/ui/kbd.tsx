"use client"

import { useEffect, useState } from "react"
import { getPlatformInfo } from "@/lib/parse"
import { cn } from "@/lib/utils"

/**
 * 键位映射表：Mac <-> Windows/Linux
 */
const KEY_MAP: Record<string, { mac: string; win: string }> = {
  // 修饰键
  "Ctrl": { mac: "⌘", win: "Ctrl" },
  "Control": { mac: "⌘", win: "Ctrl" },
  "⌘": { mac: "⌘", win: "Ctrl" },
  "Cmd": { mac: "⌘", win: "Ctrl" },
  "Command": { mac: "⌘", win: "Ctrl" },
  "Alt": { mac: "⌥", win: "Alt" },
  "Option": { mac: "⌥", win: "Alt" },
  "⌥": { mac: "⌥", win: "Alt" },
  "Shift": { mac: "⇧", win: "Shift" },
  "⇧": { mac: "⇧", win: "Shift" },
  "Meta": { mac: "⌘", win: "Win" },
  "Win": { mac: "⌘", win: "Win" },
  // 功能键
  "Enter": { mac: "↵", win: "Enter" },
  "Return": { mac: "↵", win: "Enter" },
  "↵": { mac: "↵", win: "Enter" },
  "Backspace": { mac: "⌫", win: "Backspace" },
  "⌫": { mac: "⌫", win: "Backspace" },
  "Delete": { mac: "⌦", win: "Del" },
  "⌦": { mac: "⌦", win: "Del" },
  "Escape": { mac: "⎋", win: "Esc" },
  "Esc": { mac: "⎋", win: "Esc" },
  "⎋": { mac: "⎋", win: "Esc" },
  "Tab": { mac: "⇥", win: "Tab" },
  "⇥": { mac: "⇥", win: "Tab" },
  "Space": { mac: "␣", win: "Space" },
  "␣": { mac: "␣", win: "Space" },
  // 方向键
  "Up": { mac: "↑", win: "↑" },
  "Down": { mac: "↓", win: "↓" },
  "Left": { mac: "←", win: "←" },
  "Right": { mac: "→", win: "→" },
  "↑": { mac: "↑", win: "↑" },
  "↓": { mac: "↓", win: "↓" },
  "←": { mac: "←", win: "←" },
  "→": { mac: "→", win: "→" },
}

type Platform = "mac" | "win" | "auto"

interface KbdProps extends Omit<React.ComponentProps<"kbd">, "children"> {
  /**
   * 按键内容，支持字符串或 ReactNode
   * 字符串会自动根据平台转换
   */
  children: React.ReactNode
  /**
   * 强制指定平台显示风格
   * - "auto": 自动检测（默认）
   * - "mac": 强制 Mac 风格
   * - "win": 强制 Windows 风格
   */
  platform?: Platform
}

/**
 * 转换按键文本
 */
function transformKey(key: string, isMac: boolean): string {
  const mapping = KEY_MAP[key]
  if (mapping) {
    return isMac ? mapping.mac : mapping.win
  }
  return key
}

/**
 * 键盘按键组件
 *
 * 自动根据用户平台显示对应的键位符号
 * - Mac: 使用符号 (⌘, ⌥, ⇧)
 * - Windows/Linux: 使用文字 (Ctrl, Alt, Shift)
 */
function Kbd({ className, children, platform = "auto", ...props }: KbdProps) {
  const [isMac, setIsMac] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (platform === "auto") {
      const { name } = getPlatformInfo()
      setIsMac(name === "Mac OS" || name === "macOS" || name === "iOS")
    } else {
      setIsMac(platform === "mac")
    }
  }, [platform])

  // 处理 children
  const displayContent = (() => {
    if (!mounted) return children
    if (typeof children === "string") {
      return transformKey(children, isMac)
    }
    return children
  })()

  return (
    <kbd
      data-slot="kbd"
      data-platform={isMac ? "mac" : "win"}
      className={cn(
        // 基础样式
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 px-1.5 select-none",
        // 字体 - Mac 符号需要更大字号
        isMac ? "font-sans text-[13px] font-normal" : "font-mono text-[11px] font-medium",
        // 配色 - 增强对比度
        "bg-primary-100 text-primary-800",
        // 边框和阴影
        "rounded border border-primary-300",
        "shadow-[0_1px_0_1px_var(--primary-300),inset_0_0.5px_0_rgba(255,255,255,0.5)]",
        // 图标尺寸
        "[&_svg:not([class*='size-'])]:size-3",
        // Tooltip 内的特殊样式
        "in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background in-data-[slot=tooltip-content]:border-transparent in-data-[slot=tooltip-content]:shadow-none",
        className
      )}
      {...props}
    >
      {displayContent}
    </kbd>
  )
}

interface KbdGroupProps extends React.ComponentProps<"div"> {
  /** 分隔符，默认为 "+" */
  separator?: React.ReactNode
  /** 强制指定平台显示风格 */
  platform?: Platform
}

/**
 * 键盘按键组组件
 */
function KbdGroup({ className, children, separator: _separator, platform: _platform, ...props }: KbdGroupProps) {
  return (
    <div
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * 快捷键组件 - 便捷方式显示组合键
 *
 * @example
 * <KbdShortcut keys={["Ctrl", "C"]} />
 * // Mac 显示: ⌘ C
 * // Win 显示: Ctrl + C
 */
function KbdShortcut({
  keys,
  separator = null,
  platform = "auto",
  className,
}: {
  keys: string[]
  separator?: React.ReactNode
  platform?: Platform
  className?: string
}) {
  const [isMac, setIsMac] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (platform === "auto") {
      const { name } = getPlatformInfo()
      setIsMac(name === "Mac OS" || name === "macOS" || name === "iOS")
    } else {
      setIsMac(platform === "mac")
    }
  }, [platform])

  // Mac 默认不显示分隔符，Win 默认显示 +
  const actualSeparator = separator ?? (isMac ? null : <span className="text-primary-400 text-[10px]">+</span>)

  return (
    <KbdGroup className={className}>
      {keys.map((key, index) => (
        <span key={key} className="inline-flex items-center gap-1">
          {index > 0 && actualSeparator}
          <Kbd platform={platform}>{mounted ? transformKey(key, isMac) : key}</Kbd>
        </span>
      ))}
    </KbdGroup>
  )
}

export { Kbd, KbdGroup, KbdShortcut }
