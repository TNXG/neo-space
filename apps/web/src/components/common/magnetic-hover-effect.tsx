import * as React from "react";
import { clsxm } from "@/lib/utils";

type MagneticHoverEffectProps<T extends React.ElementType> = {
  as?: T;
  children: React.ReactNode;
  variant?: "default" | "accent";
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children">;

export const MagneticHoverEffect = <T extends React.ElementType = "div">({
  as,
  children,
  variant = "default",
  className,
  ...rest
}: MagneticHoverEffectProps<T>) => {
  const Component = as || "div";

  return (
    <Component
      className={clsxm(
        "motion-hover-surface relative isolate inline-block",
        "before:absolute before:-inset-x-2 before:inset-y-0 before:z-[-1] before:rounded-xl before:backdrop-blur-sm",
        variant === "accent" ? "before:bg-primary/10" : "before:bg-muted/80",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
};

/**
 * 包裹多个 MagneticHoverEffect 组件的容器
 * 在整个容器区域内隐藏鼠标指针，避免组件间隙显示鼠标
 */
interface MagneticZoneProps {
  children: React.ReactNode;
  className?: string;
}

export const MagneticZone = ({ children, className }: MagneticZoneProps) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};
