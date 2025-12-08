import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { ThemeProvider } from "@/components/common/theme";
import { MainLayout } from "@/components/layouts/MainLayout";
import { UIProvider } from "@/lib/ui";
import "@/lib/hooks/iconify";

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

export const metadata: Metadata = {
	title: "TNXG Blog",
	description: "Personal blog powered by Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<body className={`${notoSans.variable}  ${jetbrainsMono.variable}`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange={false}
				>
					<UIProvider>
						<MainLayout>{children}</MainLayout>
					</UIProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
