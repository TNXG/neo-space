"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  icon?: string;
  description?: string;
  action?: ReactNode;
  index?: number;
  /** 默认把内容包进带分隔线的卡片；自带卡片的列表传 false。 */
  framed?: boolean;
  children: ReactNode;
}

/** 设置分节：标题、说明与操作同一行对齐，内容落在单层卡片上，避免卡片套卡片。 */
export function SettingsSection({ title, icon, description, action, index = 0, framed = true, children }: SettingsSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.28, delay: Math.min(index, 5) * 0.04, ease: [0.23, 1, 0.32, 1] }}
      aria-label={title}
      className="flex flex-col gap-3"
    >
      <header className="flex items-end justify-between gap-4 px-1">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight">
            {icon && <Icon icon={icon} className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            {title}
          </h3>
          {description && <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={cn(framed && "divide-y divide-border rounded-2xl border border-border/70 bg-card px-4 shadow-xs lg:px-5")}>
        {children}
      </div>
    </motion.section>
  );
}
