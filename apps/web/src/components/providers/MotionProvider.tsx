"use client";

import type { ReactNode } from "react";

import { MotionConfig } from "motion/react";

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * 统一全站 Motion 动画的响应节奏与无障碍降级策略。
 *
 * `reducedMotion="user"` 会在用户要求减少动态效果时移除位移动画，
 * 同时保留颜色与透明度反馈，避免交互状态变得不可感知。
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </MotionConfig>
  );
}
