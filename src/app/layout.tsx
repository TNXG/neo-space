import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * 根布局 - 仅包含全局 Provider 和基础 HTML 结构
 * 具体页面布局（Footer、FloatingNav、Nbnhhsh）由路由分组布局处理
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
