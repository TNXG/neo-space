"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useTOCStore } from "@/lib/stores/toc-store";

interface ArticleTOCProps {
	className?: string;
}

/**
 * 文章目录组件
 * 使用 zustand 状态管理实现 TOC 和正文同步高亮
 * 当进入某个大标题区域时，其子节点会略微放大并更显眼
 */
export function ArticleTOC({ className = "" }: ArticleTOCProps) {
	const { activeId, items, scrollToCenter } = useTOCStore();
	const tocRef = useRef<HTMLElement>(null);

	// 计算当前激活的父级 H2 标题 ID
	const activeParentH2Id = useMemo(() => {
		if (!activeId || items.length === 0)
			return null;

		const activeIndex = items.findIndex(item => item.id === activeId);
		if (activeIndex === -1)
			return null;

		// 如果当前激活的就是 H2，返回它自己
		if (items[activeIndex].depth === 2)
			return activeId;

		// 向上查找最近的 H2 父级
		for (let i = activeIndex - 1; i >= 0; i--) {
			if (items[i].depth === 2)
				return items[i].id;
		}

		return null;
	}, [activeId, items]);

	// 判断某个子标题是否属于当前激活的 H2 区域
	const isInActiveSection = (itemId: string, itemDepth: number): boolean => {
		if (!activeParentH2Id || itemDepth === 2)
			return false;

		const parentIndex = items.findIndex(item => item.id === activeParentH2Id);
		const itemIndex = items.findIndex(item => item.id === itemId);

		if (parentIndex === -1 || itemIndex === -1 || itemIndex <= parentIndex)
			return false;

		// 检查是否在下一个 H2 之前
		for (let i = parentIndex + 1; i < itemIndex; i++) {
			if (items[i].depth === 2)
				return false;
		}

		// 检查 itemIndex 之后是否有 H2（确保 item 在当前 section 内）
		for (let i = itemIndex + 1; i < items.length; i++) {
			if (items[i].depth === 2)
				return true;
		}

		return true;
	};

	// TOC 自动重聚焦（带防抖，避免快速滚动时抖动）
	const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!activeId || !tocRef.current)
			return;

		// 清除之前的定时器
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}

		// 延迟执行滚动，防止快速滚动时抖动
		scrollTimeoutRef.current = setTimeout(() => {
			const activeLink = document.getElementById(`toc-link-${activeId}`);
			if (activeLink && tocRef.current) {
				const container = tocRef.current;
				const relativeTop = activeLink.offsetTop;
				const targetScroll = relativeTop - (container.clientHeight / 2) + (activeLink.clientHeight / 2);

				container.scrollTo({
					top: targetScroll,
					behavior: "smooth",
				});
			}
		}, 100);

		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, [activeId]);

	if (items.length === 0)
		return null;

	const isShortTOC = items.length <= 8;

	const handleClick = (e: React.MouseEvent, id: string) => {
		e.preventDefault();
		scrollToCenter(id);
	};

	return (
		<div className={`sticky top-24 ${className}`}>
			<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 px-2">Table of Contents</h4>

			<div className="relative group">
				<nav
					ref={tocRef}
					className={`
						${isShortTOC ? "" : "max-h-[40vh] overflow-y-auto"} 
						pr-2 relative -ml-2 scroll-smooth
					`}
					style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
				>
					<style>
						{`nav::-webkit-scrollbar { display: none; }`}
					</style>

					<ul className={`space-y-0.5 ${isShortTOC ? "" : "pb-10"}`}>
						{items.map((item) => {
							const isActive = activeId === item.id;
							const isH2 = item.depth === 2;
							const isActiveParent = activeParentH2Id === item.id;
							const inActiveSection = isInActiveSection(item.id, item.depth);

							return (
								<li key={item.id}>
									<motion.a
										id={`toc-link-${item.id}`}
										href={`#${item.id}`}
										onClick={e => handleClick(e, item.id)}
										className={`
											flex items-center py-1 px-2.5 rounded-md relative cursor-pointer
											${isH2 ? "font-medium" : "pl-5"}
											${isActive
									? "text-foreground font-semibold"
									: isActiveParent
										? "text-foreground font-medium"
										: inActiveSection
											? "text-foreground/90 font-medium"
											: "text-muted-foreground/70 hover:text-foreground hover:bg-accent/20"}
										`}
										initial={false}
										animate={{
											backgroundColor: isActive
												? "rgba(var(--accent-rgb), 0.4)"
												: inActiveSection
													? "rgba(var(--accent-rgb), 0.08)"
													: "rgba(0, 0, 0, 0)",
											fontSize: isH2
												? (isActive || isActiveParent ? "13px" : "12px")
												: (isActive ? "12.5px" : inActiveSection ? "12px" : "11px"),
											paddingLeft: !isH2 ? (inActiveSection ? "16px" : "20px") : undefined,
											opacity: (!isActive && !isActiveParent && !inActiveSection) ? 0.6 : 1,
										}}
										transition={{ duration: 0.25 }}
									>
										{/* 左侧激活色条 */}
										<AnimatePresence>
											{isActive && (
												<motion.span
													key={`toc-indicator-${item.id}`}
													initial={{ opacity: 0, height: 0 }}
													animate={{ opacity: 1, height: "75%" }}
													exit={{ opacity: 0, height: 0 }}
													transition={{ duration: 0.3 }}
													className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 bg-accent-600 rounded-r-full"
												/>
											)}
										</AnimatePresence>
										{/* 父级 H2 的侧边指示条 */}
										<AnimatePresence>
											{isActiveParent && !isActive && (
												<motion.span
													key={`toc-parent-indicator-${item.id}`}
													initial={{ opacity: 0, height: 0 }}
													animate={{ opacity: 0.7, height: "70%" }}
													exit={{ opacity: 0, height: 0 }}
													transition={{ duration: 0.25 }}
													className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 bg-accent-500 rounded-r-full"
												/>
											)}
										</AnimatePresence>
										{/* 激活区域内子节点的侧边指示点 */}
										<AnimatePresence>
											{inActiveSection && !isActive && (
												<motion.span
													key={`toc-section-indicator-${item.id}`}
													initial={{ opacity: 0, scale: 0 }}
													animate={{ opacity: 0.6, scale: 1 }}
													exit={{ opacity: 0, scale: 0 }}
													transition={{ duration: 0.2 }}
													className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 bg-accent-400 rounded-full"
												/>
											)}
										</AnimatePresence>
										<span className="truncate">{item.title}</span>
									</motion.a>
								</li>
							);
						})}
					</ul>
				</nav>

				{!isShortTOC && (
					<div className="absolute bottom-0 left-0 w-full h-10 bg-linear-to-t from-background to-transparent pointer-events-none z-10" />
				)}
			</div>
		</div>
	);
}
