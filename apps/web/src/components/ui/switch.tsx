"use client";

import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** 使用 Radix 的键盘与表单语义切换布尔配置。 */
function Switch({
  className,
  size = "default",
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs outline-none transition-[background-color,border-color,transform] duration-[var(--motion-duration-press)] ease-[var(--motion-ease-out)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7 data-[state=checked]:bg-primary data-[state=unchecked]:border-foreground/15 data-[state=unchecked]:bg-input motion-reduce:transition-none motion-reduce:active:scale-100",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform duration-[var(--motion-duration-press)] ease-[var(--motion-ease-out)] group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%+2px)] data-[state=unchecked]:translate-x-0 motion-reduce:transition-none"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
