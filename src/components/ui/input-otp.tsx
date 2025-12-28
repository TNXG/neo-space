"use client";

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Icon } from "@iconify/react/offline";

import { cn } from "@/lib/utils";

/**
 * InputOTP - OTP 输入容器
 */
function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

/**
 * InputOTPGroup - OTP 输入组
 */
function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

/**
 * InputOTPSlot - 单个 OTP 输入框
 * - Glassmorphism 风格
 * - 胶囊形圆角
 * - Accent 色系 focus 状态
 */
function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        // 基础样式
        "relative flex h-12 w-12 items-center justify-center",
        "text-base font-mono font-semibold",
        // Glassmorphism
        "bg-background/50 backdrop-blur-sm",
        "border border-border/60 rounded-xl",
        "shadow-sm",
        // 过渡
        "transition-all duration-200",
        // Focus 状态 - 使用 accent 色
        "data-[active=true]:border-accent-400 data-[active=true]:ring-2 data-[active=true]:ring-accent-400/50",
        "data-[active=true]:z-10",
        // 错误状态
        "aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        "data-[active=true]:aria-invalid:border-red-500 data-[active=true]:aria-invalid:ring-red-500/50",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-accent-600 h-5 w-0.5 duration-1000" />
        </div>
      )}
    </div>
  );
}

/**
 * InputOTPSeparator - OTP 分隔符
 */
function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      className="flex items-center justify-center text-muted-foreground/50"
      {...props}
    >
      <Icon icon="mingcute:minus-line" className="w-4 h-4" />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
