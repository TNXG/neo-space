"use client";

import type { User } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
	id: string;
	title: string;
	icon: string;
	href: string;
}

const NAV_ITEMS: NavItem[] = [
	{ id: "home", title: "首页", icon: "mingcute:home-2-line", href: "/" },
	{ id: "articles", title: "文章", icon: "mingcute:book-2-line", href: "/articles" },
	{ id: "notes", title: "手记", icon: "mingcute:pen-line", href: "/notes" },
	{ id: "thoughts", title: "想法", icon: "mingcute:comment-line", href: "/thoughts" },
	{ id: "about", title: "关于", icon: "mingcute:user-4-line", href: "/about" },
];

// 头像(32) + 间距(12) + 名字区域(约50) = 约94px 基础宽度，加上 padding
const COLLAPSED_WIDTH = 130;
// 每个导航按钮 34px (p-2 = 8px*2 + 18px icon)，加上 gap-1 = 4px
const NAV_BUTTON_WIDTH = 34;
const NAV_GAP = 4;

interface FloatingNavProps {
	user: User;
}

/**
 * Floating navigation bar with two sections:
 * - Left: Expandable card with avatar and navigation
 * - Right: Back to top and theme toggle
 */
export function FloatingNav({ user }: FloatingNavProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isSpinning, setIsSpinning] = useState(false);
	const [readingProgress, setReadingProgress] = useState(0);
	const [animationProgress, setAnimationProgress] = useState(0);
	const pathname = usePathname();
	const router = useRouter();
	const isHomePage = pathname === "/";

	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	/**
	 * 处理导航点击
	 * 如果在首页且是锚点链接，平滑滚动到对应位置
	 * 如果不在首页，跳转到首页对应锚点
	 */
	const handleNavClick = useCallback((e: React.MouseEvent, item: NavItem) => {
		if (item.id === "home") {
			e.preventDefault();
			if (isHomePage) {
				scrollToTop();
			} else {
				router.push("/");
			}
			return;
		}

		// 锚点链接处理
		if (item.href.startsWith("/#")) {
			const hash = item.href.slice(1); // 获取 #xxx
			if (isHomePage) {
				e.preventDefault();
				const element = document.querySelector(hash);
				if (element) {
					element.scrollIntoView({ behavior: "smooth" });
				}
			}
			// 不在首页时，让 Link 正常跳转到 /#xxx
		}
	}, [isHomePage, router, scrollToTop]);
	// Control Back to Top visibility
	const [showBackToTop, setShowBackToTop] = useState(() => {
		if (typeof window !== "undefined") {
			return window.scrollY > 300;
		}
		return false;
	});

	const handleScrollToTopAction = useCallback((e?: React.MouseEvent) => {
		if (e?.preventDefault)
			e.preventDefault();
		// Only spin if we actually have distance to scroll
		if (window.scrollY > 100) {
			setIsSpinning(true);
			setAnimationProgress(readingProgress); // 开始动画时记录当前进度
		}
		scrollToTop();
	}, [scrollToTop, readingProgress]);

	// Monitor scroll position and calculate reading progress
	const handleScroll = useCallback(() => {
		const scrollY = window.scrollY;
		const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
		const progress = documentHeight > 0 ? (scrollY / documentHeight) * 100 : 0;

		setShowBackToTop(scrollY > 300);
		setReadingProgress(Math.min(progress, 100));

		// 如果正在执行返回顶部动画，更新动画进度
		if (isSpinning) {
			setAnimationProgress(Math.min(progress, 100));
			if (scrollY < 10) {
				setIsSpinning(false);
				setAnimationProgress(0);
			}
		}
	}, [isSpinning]);

	useEffect(() => {
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, [handleScroll]);

	// Safety timeout for spinner
	useEffect(() => {
		if (!isSpinning)
			return;
		const timeoutId = setTimeout(() => setIsSpinning(false), 3000);
		return () => clearTimeout(timeoutId);
	}, [isSpinning]);

	// 动态计算展开宽度：基础宽度 + 分隔线(1+24) + 导航按钮总宽度
	const expandedWidth = COLLAPSED_WIDTH + 25 + NAV_ITEMS.length * NAV_BUTTON_WIDTH + (NAV_ITEMS.length - 1) * NAV_GAP;

	return (
		<div className="flex gap-3 pointer-events-none bottom-8 left-0 right-0 justify-center fixed z-50">
			{/* Left Section: Expandable Navigation Card */}
			<motion.div
				className="glass-nav rounded-full flex h-14 pointer-events-auto items-center"
				animate={{
					width: isExpanded ? expandedWidth : COLLAPSED_WIDTH,
				}}
				transition={{
					type: "spring",
					stiffness: 400,
					damping: 35,
				}}
				onMouseEnter={() => setIsExpanded(true)}
				onMouseLeave={() => setIsExpanded(false)}
			>
				<div className="px-3 flex gap-3 items-center">
					{/* Avatar with pulse hint */}
					<div className="shrink-0 relative">
						{/* Pulse ring animation - 外部光环 */}
						<div
							className={`absolute inset-0 transition-opacity duration-300 ${isExpanded ? "opacity-0" : "opacity-100"}`}
						>
							<div className="absolute inset-[-3px] rounded-full border-2 border-accent-500 animate-pulse-ring" />
							<div className="absolute inset-[-3px] rounded-full border-2 border-accent-500 animate-pulse-ring-delayed" />
						</div>
						{user.avatar
							? (
									<img
										src={user.avatar}
										alt={user.name}
										className="relative z-10 text-neutral-600 rounded-full h-8 w-8 object-cover"
									/>
								)
							: (
									<div className="relative z-10 text-neutral-600 text-xs font-bold rounded-full flex h-8 w-8 items-center justify-center from-stone-200 to-stone-300 bg-linear-to-tr dark:from-stone-700 dark:to-stone-600">
										{user.name.charAt(0).toUpperCase()}
									</div>
								)}
					</div>

					{/* Status / Name */}
					<div className="shrink-0">
						<span className="text-primary-900 text-xs font-bold whitespace-nowrap">{user.name}</span>
						<span className="text-accent-600 text-[10px] flex gap-1 whitespace-nowrap items-center">
							<Icon icon="mingcute:sparkles-line" className="text-[8px]" />
							在线
						</span>
					</div>

					{/* Divider + Navigation Menu - 展开时显示 */}
					<motion.div
						className="flex gap-2 items-center overflow-hidden"
						animate={{
							opacity: isExpanded ? 1 : 0,
							width: isExpanded ? "auto" : 0,
						}}
						transition={{ duration: 0.2 }}
					>
						<div className="border-neutral-300 shrink-0 h-6 w-px bg-current" />
						<div className="flex gap-1 items-center">
							{NAV_ITEMS.map((item, index) => (
								<Tooltip key={item.id}>
									<TooltipTrigger asChild>
										<motion.div
											initial={{ backgroundColor: "transparent" }}
											animate={{
												opacity: isExpanded ? 1 : 0,
												scale: isExpanded ? 1 : 0.5,
												backgroundColor: "transparent",
											}}
											whileHover={{
												backgroundColor: "var(--accent-100)",
											}}
											transition={{
												duration: 0.15,
												delay: isExpanded ? index * 0.03 : 0,
											}}
											className="p-2 rounded-full cursor-pointer"
										>
											<Link
												href={item.href}
												className="text-neutral-600 block"
												onClick={e => handleNavClick(e, item)}
											>
												<Icon icon={item.icon} className="text-[18px]" />
											</Link>
										</motion.div>
									</TooltipTrigger>
									<TooltipContent side="top">{item.title}</TooltipContent>
								</Tooltip>
							))}
						</div>
					</motion.div>
				</div>
			</motion.div>

			{/* Right Section: Actions (Back to Top + Theme Toggle) */}
			<motion.div
				className="glass-nav rounded-full flex h-14 pointer-events-auto items-center overflow-hidden"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
			>
				{/* Back to Top - Only show when scrolled > 300px */}
				<motion.div
					animate={{
						width: showBackToTop ? "auto" : 0,
						opacity: showBackToTop ? 1 : 0,
						scale: showBackToTop ? 1 : 0,
						paddingLeft: showBackToTop ? 12 : 0,
					}}
					initial={{ width: 0, opacity: 0, scale: 0, paddingLeft: 0 }}
					transition={{ duration: 0.3 }}
					style={{ overflow: "hidden" }}
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<motion.button
								type="button"
								onClick={handleScrollToTopAction}
								className="text-neutral-600 rounded-full cursor-pointer whitespace-nowrap relative w-10 h-10 flex items-center justify-center"
								initial={{ backgroundColor: "transparent" }}
								whileHover={{
									backgroundColor: "var(--accent-100)",
								}}
								transition={{ duration: 0.2 }}
								aria-label={`返回顶部 (${Math.round(isSpinning ? animationProgress : readingProgress)}%)`}
							>
								{/* 进度圈背景 */}
								<svg
									className="absolute inset-0 w-full h-full -rotate-90"
									viewBox="0 0 36 36"
								>
									{/* 背景圈 */}
									<circle
										cx="18"
										cy="18"
										r="16"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										opacity="0.1"
									/>
									{/* 进度圈 */}
									<motion.circle
										cx="18"
										cy="18"
										r="16"
										fill="none"
										stroke={
											(isSpinning ? animationProgress : readingProgress) >= 95
												? "var(--accent-400)"
												: "var(--accent-500)"
										}
										strokeWidth="2"
										strokeLinecap="round"
										strokeDasharray="100.53"
										initial={{ strokeDashoffset: 100.53 }}
										animate={{
											strokeDashoffset: isSpinning
												? 100.53 - (animationProgress / 100) * 100.53
												: 100.53 - (readingProgress / 100) * 100.53,
										}}
										transition={{
											duration: 0.3,
											ease: "easeOut",
										}}
									/>
								</svg>

								{/* 图标 */}
								<div className="relative z-10">
									{isSpinning
										? (
												<motion.div
													className="h-[18px] w-[18px] border-2 border-current border-t-transparent rounded-full"
													animate={{ rotate: 360 }}
													transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
												/>
											)
										: (
												<Icon icon="mingcute:arrow-up-line" className="text-[18px]" />
											)}
								</div>
							</motion.button>
						</TooltipTrigger>
						<TooltipContent side="top">
							返回顶部 (
							{Math.round(isSpinning ? animationProgress : readingProgress)}
							%)
						</TooltipContent>
					</Tooltip>
				</motion.div>

				{/* Theme Toggle */}
				<div className="px-3">
					<ThemeToggle />
				</div>
			</motion.div>
		</div>
	);
}
