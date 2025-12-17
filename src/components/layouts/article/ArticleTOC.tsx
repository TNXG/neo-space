"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useTOCStore } from "@/lib/stores/toc-store";

interface ArticleTOCProps {
	className?: string;
}

/**
 * 文章目录组件
 * 使用 zustand 状态管理实现 TOC 和正文同步高亮
 */
export function ArticleTOC({ className = "" }: ArticleTOCProps) {
	const { activeId, items, scrollToCenter } = useTOCStore();
	const tocRef = useRef<HTMLElement>(null);

	// TOC 自动重聚焦
	useEffect(() => {
		if (!activeId || !tocRef.current)
			return;

		const activeLink = document.getElementById(`toc-link-${activeId}`);
		if (activeLink) {
			const container = tocRef.current;
			const relativeTop = activeLink.offsetTop;
			const targetScroll = relativeTop - (container.clientHeight / 2) + (activeLink.clientHeight / 2);

			container.scrollTo({
				top: targetScroll,
				behavior: "smooth",
			});
		}
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
			<h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-2">
				目录
			</h4>

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

							return (
								<li key={item.id}>
									<motion.a
										id={`toc-link-${item.id}`}
										href={`#${item.id}`}
										onClick={e => handleClick(e, item.id)}
										className={`
											flex items-center py-1 px-2.5 rounded-md transition-all duration-300 relative cursor-pointer
											${isH2 ? "text-xs font-medium" : "pl-5 text-[11px]"}
											${isActive
									? "text-foreground font-semibold"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/20"}
										`}
										initial={false}
										animate={{
											backgroundColor: isActive ? "rgba(var(--accent-rgb), 0.4)" : "rgba(0, 0, 0, 0)",
										}}
										transition={{ duration: 0.3 }}
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
													className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] bg-accent-600 rounded-r-full"
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
