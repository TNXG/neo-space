"use client";

import type { User } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";

interface NavItem {
	id: string;
	title: string;
	icon: string;
	href: string;
}

const NAV_ITEMS: NavItem[] = [
	{ id: "home", title: "首页", icon: "mingcute:home-2-line", href: "#" },
	{ id: "articles", title: "文章", icon: "mingcute:book-2-line", href: "#articles" },
	{ id: "notes", title: "手记", icon: "mingcute:pen-line", href: "#notes" },
	{ id: "thoughts", title: "想法", icon: "mingcute:comment-line", href: "#thoughts" },
	{ id: "about", title: "关于", icon: "mingcute:user-4-line", href: "#about" },
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

	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

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
						{/* Pulse rings - 使用 CSS 动画避免闪烁 */}
						<div
							className={`absolute inset-0 rounded-full bg-accent-500 z-0 animate-pulse-ring transition-opacity duration-300 ${isExpanded ? "opacity-0" : "opacity-100"}`}
						/>
						<div
							className={`absolute inset-0 rounded-full bg-accent-500 z-0 animate-pulse-ring-delayed transition-opacity duration-300 ${isExpanded ? "opacity-0" : "opacity-100"}`}
						/>
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
								<motion.div
									key={item.id}
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
										className="text-neutral-600 group block"
										title={item.title}
									>
										<Icon icon={item.icon} className="text-[18px]" />
										<span className="glass-tooltip text-xs px-2 py-1 rounded opacity-0 pointer-events-none whitespace-nowrap transition-opacity duration-200 left-1/2 absolute group-hover:opacity-100 -translate-x-1/2 -top-10">
											{item.title}
										</span>
									</Link>
								</motion.div>
							))}
						</div>
					</motion.div>
				</div>
			</motion.div>

			{/* Right Section: Actions (Back to Top + Theme Toggle) */}
			<motion.div
				className="glass-nav px-2 rounded-full flex gap-1 h-14 pointer-events-auto items-center"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
			>
				{/* Back to Top */}
				<motion.button
					type="button"
					onClick={scrollToTop}
					className="text-neutral-600 group p-2 rounded-full cursor-pointer relative"
					initial={{ backgroundColor: "transparent" }}
					whileHover={{
						backgroundColor: "var(--accent-100)",
					}}
					transition={{ duration: 0.2 }}
					aria-label="返回顶部"
				>
					<Icon icon="mingcute:arrow-up-line" className="text-[18px]" />
					<span className="glass-tooltip text-xs px-2 py-1 rounded opacity-0 pointer-events-none whitespace-nowrap transition-opacity duration-200 left-1/2 absolute group-hover:opacity-100 -translate-x-1/2 -top-10">
						返回顶部
					</span>
				</motion.button>

				{/* Theme Toggle */}
				<ThemeToggle />
			</motion.div>
		</div>
	);
}
