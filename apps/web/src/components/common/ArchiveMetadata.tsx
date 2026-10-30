"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ArchiveMetadataProps {
  children: ReactNode;
  className?: string;
}

/**
 * 短元数据靠右；标题占宽后优先收缩元数据，仅溢出时启用末端渐隐。
 * @param props 分类、标签内容与容器布局
 * @returns 不挤压文章标题的元数据
 */
export function ArchiveMetadata({ children, className }: ArchiveMetadataProps) {
  const contentRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    /** 内容或可用宽度变化后，按实际溢出状态更新遮罩。 */
    const updateOverflow = () => {
      content.dataset.overflow = String(content.scrollWidth > content.clientWidth);
    };
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span className={cn("flex min-w-0 justify-end text-xs text-muted-foreground/50", className)}>
      <span ref={contentRef} className="block min-w-0 overflow-hidden whitespace-nowrap data-[overflow=true]:mask-[linear-gradient(to_right,black_calc(100%-2rem),transparent)]">
        {children}
      </span>
    </span>
  );
}
