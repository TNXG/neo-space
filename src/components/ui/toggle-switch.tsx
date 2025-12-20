"use client";

import { motion, PanInfo } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VerticalSliderProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

/**
 * 垂直滑块组件 - 长方形滑块样式
 * 
 * 交互逻辑：
 * - 点击滑块：直接切换状态
 * - 长按拖动：根据拖动方向切换状态
 * - 点击轨道：直接切换状态
 */
export function VerticalSlider({
  checked,
  onChange,
  size = "sm",
  disabled = false,
  className,
}: VerticalSliderProps) {
  const [isDraggable, setIsDraggable] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasMovedRef = useRef(false);

  // 定义垂直尺寸配置
  const sizeClasses = {
    sm: {
      container: "w-4 h-8", // 容器：更小巧
      track: "w-[1.5px]",   // 轨道：更细的垂直线
      thumb: "w-4 h-2.5 rounded-[2px]", // 滑块：扁平长方形
      travelDistance: 18,   // h-8(32px) - h-2.5(10px) - padding(4px留白) = 18px
      paddingY: 2,          // 上下留白
    },
    md: {
      container: "w-5 h-10",
      track: "w-[2px]",
      thumb: "w-5 h-3 rounded-[2px]",
      travelDistance: 22,
      paddingY: 2.5,
    },
  };

  const { container, track, thumb, travelDistance, paddingY } = sizeClasses[size];

  // 处理长按开始
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.stopPropagation();
    
    hasMovedRef.current = false;
    
    // 设置长按定时器（200ms 后允许拖动）
    longPressTimerRef.current = setTimeout(() => {
      setIsDraggable(true);
    }, 200);
  };

  // 处理长按结束
  const handlePointerUp = () => {
    if (disabled) return;
    
    // 清除长按定时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // 如果没有移动且没有进入拖动状态，说明是点击
    if (!hasMovedRef.current && !isDraggable) {
      onChange(!checked);
    }
    
    setIsDraggable(false);
  };

  // 处理拖拽开始
  const handleDragStart = () => {
    hasMovedRef.current = true;
  };

  // 处理拖拽结束逻辑 (Y轴)
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;

    const dragDistance = info.offset.y;
    const threshold = travelDistance / 4;

    // 拖拽判定
    // 逻辑：开启状态(在顶部)，向下拉(>0) -> 关闭
    //      关闭状态(在底部)，向上推(<0) -> 开启
    if (Math.abs(dragDistance) >= threshold) {
      if (checked && dragDistance > 0) {
        onChange(false);
      } else if (!checked && dragDistance < 0) {
        onChange(true);
      }
    }
    
    setIsDraggable(false);
    hasMovedRef.current = false;
  };

  // 处理容器点击
  const handleContainerClick = (e: React.MouseEvent) => {
    if (disabled) return;
    // 只有点击容器（轨道）时才切换，点击滑块不触发
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('track')) {
      onChange(!checked);
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        "relative inline-flex flex-col items-center justify-center cursor-pointer touch-none select-none",
        container,
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      role="switch"
      aria-checked={checked}
    >
      {/* 垂直轨道线 */}
      <div
        className={cn(
          "absolute h-full rounded-full transition-colors duration-300 track",
          track,
          checked 
            ? "bg-primary/50" 
            : "bg-zinc-300 dark:bg-zinc-600"
        )}
      />

      {/* 方块滑块 */}
      <motion.div
        className={cn(
          "absolute z-10 flex items-center justify-center shadow-sm border",
          thumb,
          "bg-white dark:bg-zinc-100",
          checked 
            ? "border-primary bg-primary text-primary-foreground shadow-md" 
            : "border-zinc-300 dark:border-zinc-500",
          !disabled && "cursor-pointer",
        )}
        
        // 初始位置：只设定 Top 边距，通过 y 变换来移动
        style={{ top: paddingY }}
        
        // 1. Y 轴拖拽（只有长按后才允许拖动）
        drag={disabled ? false : (isDraggable ? "y" : false)}
        
        // 2. 拖拽限制
        // 如果当前是开启(在顶部 y=0)，只能往下拉(bottom: travelDistance)
        // 如果当前是关闭(在底部 y=travelDistance)，只能往上推(top: -travelDistance)
        dragConstraints={{ 
            top: checked ? 0 : -travelDistance, 
            bottom: checked ? travelDistance : 0 
        }}
        
        dragElastic={0.1}
        dragMomentum={false}
        
        // 3. 动画状态
        // checked=true (开) -> y: 0 (顶部)
        // checked=false (关) -> y: travelDistance (底部)
        animate={{
          y: checked ? 0 : travelDistance,
          backgroundColor: checked ? "var(--primary)" : "#ffffff",
          borderColor: checked ? "var(--primary)" : "rgba(212, 212, 216, 0.8)",
        }}
        
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 28,
        }}

        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* 装饰：方块中间加一根横线，增加机械质感 */}
        <div className={cn(
            "w-[60%] h-[2px] rounded-full opacity-40",
            checked ? "bg-white" : "bg-zinc-400"
        )} />
      </motion.div>
    </div>
  );
}