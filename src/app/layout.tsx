import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { Toaster } from "sonner";
import { IconProvider } from "@/components/common/IconProvider";
import { FloatingNav } from "@/components/common/navigation/FloatingNav";
import { NbnhhshPanel, NbnhhshProvider } from "@/components/common/nbnhhsh";
import { ThemeProvider } from "@/components/common/theme";
import { Footer } from "@/components/layouts/Footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteConfig, getUserProfile } from "@/lib/api-client";

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
				template: `%s | ${seo.title}`,
				default: seo.title,
			},
			description: seo.description,
			keywords: seo.keywords,
		};
	} catch {
		// 降级到默认值
		return {
			title: {
				template: "%s | Blog",
				default: "Blog",
			},
			description: "Personal blog powered by Neo-Space",
		};
	}
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	// 获取用户数据用于 Footer
	const profileResponse = await getUserProfile().catch(() => ({
		data: {
			_id: "",
			username: "guest",
			name: "访客用户",
			introduce: "欢迎来到我的博客",
			avatar: "/default-avatar.png",
			mail: "",
			url: "",
			created: new Date().toISOString(),
			last_login_time: new Date().toISOString(),
		},
	}));

	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<body className={`${notoSans.variable}  ${jetbrainsMono.variable} selection:bg-accent-500/30 selection:text-primary-900 font-sans flex flex-col min-h-screen`}>
				<IconProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange={false}
					>
						<TooltipProvider>
							<NbnhhshProvider>
								<div className="flex flex-col min-h-screen">
									<main className="flex-1">
										{children}
									</main>
									<Footer user={profileResponse.data} />
									<FloatingNav user={profileResponse.data} />
								</div>
								<NbnhhshPanel />
								<Toaster richColors position="top-center" />
							</NbnhhshProvider>
						</TooltipProvider>
					</ThemeProvider>
				</IconProvider>
			</body>
		</html>
	);
}
