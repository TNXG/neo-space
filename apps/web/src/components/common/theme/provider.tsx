"use client";

import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * 主题 Provider 包装。
 *
 * Next.js 16 canary 的 react-dom 对客户端组件内渲染的 <script> 会抛出
 * "Encountered a script tag while rendering React component" 警告，而
 * next-themes 正是靠在客户端组件里注入 <script> 来避免主题闪烁。
 * 这里把 next-themes 的脚本设为不可执行的 data block（type: application/json），
 * 真正的防闪烁脚本改由 app/[locale]/layout.tsx 在服务端内联注入，
 * 既保留 next-themes 的主题切换上下文，又绕开 canary 的脚本校验。
 */
export const ThemeProvider = ({ children, ...props }: ThemeProviderProps) => {
  return (
    <NextThemesProvider scriptProps={{ type: "application/json" }} {...props}>
      {children}
    </NextThemesProvider>
  );
};

export default ThemeProvider;
