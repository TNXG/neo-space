"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

/** 以完整路径为键重建正文边界，让每次路由切换形成进入 / 退出配对；同页数据更新不参与过渡。 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ViewTransition
      key={pathname}
      name="page-content"
      enter="page-transition"
      exit="page-transition"
      default="none"
    >
      <div className="min-w-0">{children}</div>
    </ViewTransition>
  );
}
