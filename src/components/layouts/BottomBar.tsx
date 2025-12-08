"use client";

import { motion, useAnimationControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTheme } from "@/components/common";
import { IconArrowUp, IconComputer, IconMoon, IconSearch, IconSun } from "@/components/icons";
import { ActionPill } from "@/components/ui";
import { useUI } from "@/lib/hooks/useUI";

/**
 * 主题图标组件 - 根据当前主题状态显示对应图标
 */
function ThemeIcon({ isSystem, isLight, mounted, className }: {
	isSystem: boolean;
	isLight: boolean;
	mounted: boolean;
	className?: string;
}) {
	// 未挂载时显示默认图标，避免 hydration 问题
	if (!mounted) {
		return <IconSun className={className} />;
	}
	if (isSystem) {
		return <IconComputer className={className} />;
	}
	if (isLight) {
		return <IconSun className={className} />;
	}
	return <IconMoon className={className} />;
}

export function BottomBar() {
	const ui = useUI();
	const theme = useTheme();
	const barControls = useAnimationControls();
	const isVisibleRef = useRef(true);
	const lastScrollY = useRef(0);
	const [mounted, setMounted] = useState(false);

	const handleScroll = useCallback(() => {
		const currentScrollY = window.scrollY;
		const isScrollingDown = currentScrollY > lastScrollY.current && currentScrollY > 100;

		if (isScrollingDown && isVisibleRef.current) {
			isVisibleRef.current = false;
			barControls.start({
				y: 100,
				opacity: 0,
				transition: { duration: 0.3, ease: "easeIn" },
			});
		} else if (!isScrollingDown && !isVisibleRef.current) {
			isVisibleRef.current = true;
			barControls.start({
				y: 0,
				opacity: 1,
				transition: { duration: 0.3, type: "spring", stiffness: 400, damping: 17 },
			});
		}

		lastScrollY.current = currentScrollY;
	}, [barControls]);

	useEffect(() => {
		// 初始入场动画
		barControls.start({
			y: 0,
			opacity: 1,
			transition: {
				duration: 0.6,
				type: "spring",
				stiffness: 300,
				damping: 20,
				delay: 0.3,
			},
		});

		// 延迟设置 mounted 状态
		const timer = setTimeout(() => setMounted(true), 0);

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			clearTimeout(timer);
			window.removeEventListener("scroll", handleScroll);
		};
	}, [barControls, handleScroll]);

	const handleScrollTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handleSearch = () => {
		ui.openDrawer(
			<div className="p-8">
				<h2 className="text-xl font-bold mb-4">Search</h2>
				<p className="text-gray-500">Search UI Placeholder</p>
			</div>,
		);
	};

	return (
		<motion.div
			initial={{ y: 100, opacity: 0 }}
			animate={barControls}
			className="p-1.5 border border-gray-200/60 rounded-full bg-white/90 flex gap-2 shadow-2xl transition-colors duration-300 bottom-6 left-1/2 fixed z-50 backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(30,30,30,0.85)] -translate-x-1/2"
		>
			{/* 使用 opacity 动画而非 scale，避免布局抖动 */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={mounted ? { opacity: 1 } : {}}
				transition={{ duration: 0.2, delay: 0.4 }}
			>
				<ActionPill icon={IconArrowUp} ariaLabel="回到顶部" onClick={handleScrollTop} />
			</motion.div>
			<motion.div
				initial={{ opacity: 0 }}
				animate={mounted ? { opacity: 1 } : {}}
				transition={{ duration: 0.2, delay: 0.5 }}
			>
				<ActionPill icon={IconSearch} ariaLabel="搜索" onClick={handleSearch} />
			</motion.div>
			<div className="mx-1 bg-gray-300/50 h-4 w-px transition-colors duration-300 self-center dark:bg-white/20" />
			<motion.div
				initial={{ opacity: 0 }}
				animate={mounted ? { opacity: 1 } : {}}
				transition={{ duration: 0.2, delay: 0.6 }}
			>
				<ActionPill
					icon={props => (
						<ThemeIcon
							isSystem={theme.isSystem}
							isLight={theme.isLight}
							mounted={theme.mounted}
							className={props.className}
						/>
					)}
					ariaLabel={theme.isSystem ? "系统主题" : theme.isLight ? "亮色主题" : "暗色主题"}
					onClick={theme.toggleTheme}
				/>
			</motion.div>
		</motion.div>
	);
}
