import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  as?: "div" | "article" | "section";
  padding?: string;
  children?: ReactNode;
}

export function GlassCard({
  children,
  className,
  hoverEffect,
  as: Component = "div",
  padding,
  style,
  ...props
}: GlassCardProps) {
  return (
    <Component
      className={cn(
        "text-(--text-main) bg-(--bg-card) border border-(--border-color) rounded-[20px] transition-all duration-300 ease-out relative overflow-hidden backdrop-blur-xl",
        padding || "p-6",
        hoverEffect && "hover:bg-(--bg-card-hover) hover:-translate-y-1 hover:shadow-lg cursor-pointer",
        className
      )}
      style={{
        boxShadow: hoverEffect ? "var(--shadow-hover)" : "var(--shadow-soft)",
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
