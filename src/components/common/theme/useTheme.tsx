"use client";

import { useTheme as useNextTheme } from "next-themes";
import { useCallback } from "react";
import { useHasMounted } from "@/hook/use-has-mounted";

/**
 * 主题管理 Hook
 * 提供主题切换、状态获取等功能
 */
export const useTheme = () => {
	const { setTheme, theme, systemTheme, resolvedTheme } = useNextTheme();
	const mounted = useHasMounted();

	/**
	 * 循环切换主题: system -> light -> dark -> system
	 */
	const toggleTheme = useCallback(() => {
		if (!mounted)
			return;

		if (theme === "system") {
			setTheme("light");
		} else if (theme === "light") {
			setTheme("dark");
		} else {
			setTheme("system");
		}
	}, [theme, setTheme, mounted]);

	// resolvedTheme 是实际生效的主题（考虑了 system 的解析）
	const currentTheme = mounted ? resolvedTheme : undefined;

	return {
		/** 当前实际生效的主题 ('light' | 'dark') */
		theme: currentTheme,
		/** 用户设置的主题 ('light' | 'dark' | 'system') */
		rawTheme: mounted ? theme : undefined,
		/** 系统主题 */
		systemTheme: mounted ? systemTheme : undefined,
		/** 设置主题 */
		setTheme,
		/** 循环切换主题 */
		toggleTheme,
		/** 是否已挂载（用于避免 hydration 问题） */
		mounted,
		/** 是否为跟随系统 */
		isSystem: mounted && theme === "system",
		/** 是否为亮色主题 */
		isLight: mounted && currentTheme === "light",
		/** 是否为暗色主题 */
		isDark: mounted && currentTheme === "dark",
	};
};
