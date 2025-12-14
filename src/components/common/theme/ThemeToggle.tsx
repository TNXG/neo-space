"use client";

import { Icon } from "@iconify/react/offline";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Theme toggle button component
 * Cycles between light, dark, and system mode
 */
export function ThemeToggle() {
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme } = useTheme();

	useEffect(() => {
		const timer = setTimeout(() => {
			setMounted(true);
		}, 0);

		return () => clearTimeout(timer);
	}, []);

	if (!mounted) {
		return (
			<button
				type="button"
				className="p-2 rounded-full shrink-0 transition-colors duration-200 text-neutral-600"
				aria-label="切换主题"
			>
				<Icon icon="mingcute:sun-line" className="text-[18px]" />
			</button>
		);
	}

	const getThemeConfig = (currentTheme: string | undefined) => {
		switch (currentTheme) {
			case "light":
				return {
					icon: "mingcute:sun-line",
					label: "亮色模式",
					next: "dark",
				};
			case "dark":
				return {
					icon: "mingcute:moon-line",
					label: "暗色模式",
					next: "system",
				};
			case "system":
			default:
				return {
					icon: "mingcute:computer-line",
					label: "跟随系统",
					next: "light",
				};
		}
	};

	const themeConfig = getThemeConfig(theme);

	const toggleTheme = () => {
		setTheme(themeConfig.next);
	};

	return (
		<button
			type="button"
			onClick={toggleTheme}
			className="group p-2 rounded-full shrink-0 cursor-pointer transition-colors duration-200 relative hover:bg-accent-100 text-neutral-600"
			aria-label={`当前: ${themeConfig.label}`}
		>
			<Icon icon={themeConfig.icon} className="text-[18px]" />
			<span className="glass-tooltip text-xs px-2 py-1 rounded opacity-0 pointer-events-none whitespace-nowrap transition-opacity duration-200 left-1/2 absolute group-hover:opacity-100 -translate-x-1/2 -top-10">
				{themeConfig.label}
			</span>
		</button>
	);
}
