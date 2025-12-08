"use client";

import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
	IconBook,
	IconFriends,
	IconHome,
} from "@/components/icons";
import { Avatar } from "@/components/ui";

interface IHeaderMenu {
	title: string;
	path: string;
	icon: React.ReactNode;
}

const headerMenuConfig: IHeaderMenu[] = [
	{
		title: "首页",
		path: "/",
		icon: <IconHome className="h-5 w-5" />,
	},
	{
		title: "文章",
		path: "/posts",
		icon: <IconBook className="h-5 w-5" />,
	},
	{
		title: "手记",
		path: "/notes",
		icon: <Icon icon="mingcute:quill-pen-fill" className="h-5 w-5" />,
	},
	{
		title: "思考",
		path: "/thinking",
		icon: <Icon icon="mingcute:bulb-fill" className="h-5 w-5" />,
	},
	{
		title: "时光",
		path: "/timeline",
		icon: <Icon icon="mingcute:history-fill" className="h-5 w-5" />,
	},
	{
		title: "友链",
		path: "/friends",
		icon: <IconFriends className="h-5 w-5" />,
	},
	{
		title: "更多",
		path: "#",
		icon: <Icon icon="mingcute:more-2-fill" className="h-5 w-5" />,
	},
];

/** 收起状态的宽度 */
const COLLAPSED_WIDTH = 160;
/** 展开状态的宽度 */
const EXPANDED_WIDTH = 520;

export function NavBar() {
	const [isHovered, setIsHovered] = useState(false);
	const pathname = usePathname();
	const prefersReducedMotion = useReducedMotion();
	const containerRef = useRef<HTMLDivElement>(null);

	const handleMouseEnter = useCallback(() => {
		setIsHovered(true);
	}, []);

	const handleMouseLeave = useCallback(() => {
		setIsHovered(false);
	}, []);

	// 动画配置，支持用户偏好减少动画
	const springTransition = prefersReducedMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 400, damping: 25 };

	const smoothTransition = prefersReducedMotion
		? { duration: 0 }
		: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const };

	return (
		<div
			ref={containerRef}
			className="flex gap-4 items-center left-6 top-6 fixed z-50"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{/* Avatar Container - 固定尺寸容器防止缩放时影响布局 */}
			<div className="shrink-0 h-12 w-12 relative">
				<motion.div
					className="will-change-transform origin-center inset-0 absolute"
					initial={false}
					animate={{ scale: isHovered ? 1.1 : 1 }}
					transition={springTransition}
				>
					<Avatar src="https://github.com/tnxg.png" size="w-12 h-12" />
				</motion.div>
				<div className="border-2 border-white rounded-full bg-green-500 h-4 w-4 absolute z-10 -bottom-1 -right-1" />
			</div>

			{/* Content Container - 使用固定宽度而非 maxWidth 减少布局抖动 */}
			<motion.div
				className="py-2 will-change-[width] border border-white/20 rounded-full bg-white/80 flex gap-4 shadow-lg items-center overflow-hidden backdrop-blur-md dark:bg-gray-800/80"
				initial={false}
				animate={{
					width: isHovered ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
					paddingLeft: isHovered ? 16 : 12,
					paddingRight: isHovered ? 16 : 12,
				}}
				transition={smoothTransition}
				style={{ willChange: "width, padding" }}
			>
				{/* Dynamic Info */}
				<div className="flex shrink-0 flex-col">
					<div className="flex gap-2 items-center">
						<span className="text-sm text-gray-800 font-bold whitespace-nowrap dark:text-gray-200">Tnxg</span>
						<AnimatePresence mode="wait">
							{!isHovered && (
								<motion.span
									key="collapsed-status"
									className="text-xs text-gray-500 flex gap-1 whitespace-nowrap items-center dark:text-gray-400"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
								>
									<Icon icon="mingcute:music-2-line" className="h-3 w-3" />
									Focusing
								</motion.span>
							)}
						</AnimatePresence>
					</div>
					<AnimatePresence mode="wait">
						{isHovered && (
							<motion.div
								key="expanded-status"
								className="text-xs text-gray-500 flex gap-1 whitespace-nowrap items-center dark:text-gray-400"
								initial={{ opacity: 0, y: -5 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -5 }}
								transition={{ duration: 0.2 }}
							>
								<Icon icon="mingcute:music-2-line" className="shrink-0 h-3 w-3" />
								<span className="truncate">Nujabes - Aruarian Dance</span>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{/* Navigation Menu (Visible on Hover) */}
				<AnimatePresence mode="popLayout">
					{isHovered && (
						<motion.nav
							key="nav-menu"
							className="flex gap-1 items-center"
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -20 }}
							transition={{ duration: 0.25, ease: "easeOut" }}
							layout
						>
							<div className="mx-2 bg-gray-200 shrink-0 h-8 w-px dark:bg-gray-600" />
							{headerMenuConfig.map((item, index) => {
								const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
								return (
									<motion.div
										key={item.path}
										className="nav-item group/item shrink-0 relative"
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{
											duration: 0.25,
											delay: prefersReducedMotion ? 0 : 0.03 * index,
											type: "spring",
											stiffness: 400,
											damping: 25,
										}}
									>
										<Link
											href={item.path}
											className={`p-2 rounded-full flex cursor-pointer transition-colors duration-150 items-center justify-center ${
												isActive
													? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30"
													: "text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:bg-gray-100 dark:hover:text-blue-400 dark:hover:bg-gray-700"
											} active:scale-90`}
											title={item.title}
											aria-current={isActive ? "page" : undefined}
										>
											{item.icon}
										</Link>
									</motion.div>
								);
							})}
						</motion.nav>
					)}
				</AnimatePresence>
			</motion.div>
		</div>
	);
}
