import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

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
  const locale = (await headers()).get("x-next-intl-locale") || "zh";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${notoSans.variable} ${jetbrainsMono.variable} selection:bg-accent-500/30 selection:text-primary-900 font-sans`}>
        {children}
      </body>
    </html>
  );
}
