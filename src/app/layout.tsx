import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { Toaster } from "sonner";
import { IconProvider } from "@/components/common/IconProvider";
import { ThemeProvider } from "@/components/common/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteConfig } from "@/lib/api-client";

import "./globals.css";

const notoSans = Noto_Sans_SC({
	variable: "--font-noto-sans",
	subsets: ["latin", "latin-ext"],
	weight: ["400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
	variable: "--font-jetbrains-mono",
	subsets: ["latin"],
});

/**
 * 生成动态 SEO 元数据
 */
export async function generateMetadata(): Promise<Metadata> {
	try {
		const configResponse = await getSiteConfig();
		const { seo } = configResponse.data;

		return {
			title: {
				template: `%s - ${seo.title}`,
				default: seo.title,
			},
			description: seo.description,
			keywords: seo.keywords,
		};
	} catch {
		return {
			title: {
				template: "%s - Blog",
				default: "Blog",
			},
			description: "Personal blog powered by Neo-Space",
		};
	}
}

/**
 * 根布局 - 仅包含全局 Provider 和基础 HTML 结构
 * 具体页面布局（Footer、FloatingNav、Nbnhhsh）由路由分组布局处理
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<body className={`${notoSans.variable} ${jetbrainsMono.variable} selection:bg-accent-500/30 selection:text-primary-900 font-sans`}>
				<IconProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange={false}
					>
						<TooltipProvider>
							{children}
							<Toaster richColors position="top-center" />
						</TooltipProvider>
					</ThemeProvider>
				</IconProvider>
			</body>
		</html>
	);
}
