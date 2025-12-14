import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { IconProvider } from "@/components/common/IconProvider";
import { NbnhhshPanel, NbnhhshProvider } from "@/components/common/nbnhhsh";
import { ThemeProvider } from "@/components/common/theme";

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
			<body className={`${notoSans.variable}  ${jetbrainsMono.variable} selection:bg-accent-500/30 selection:text-primary-900 font-sans flex flex-col min-h-screen`}>
				<IconProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange={false}
					>
						<NbnhhshProvider>
							{children}
							<NbnhhshPanel />
						</NbnhhshProvider>
					</ThemeProvider>
				</IconProvider>
			</body>
		</html>
	);
}
