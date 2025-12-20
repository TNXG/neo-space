"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useTOCStore } from "@/lib/stores/toc-store";

interface ArticleTOCProps {
	className?: string;
}

export function ArticleTOC({ className = "" }: ArticleTOCProps) {
	const { activeId, items, scrollToCenter, isAutoScrollEnabled } = useTOCStore();
	const tocRef = useRef<HTMLElement>(null);

	// 1. 解决 Compiler 警告：移除复杂的条件 return，改为扁平化计算
	// 计算当前激活项的索引
	const activeIndex = useMemo(() => {
		if (!activeId || items.length === 0)
			return -1;
		return items.findIndex(item => item.id === activeId);
	}, [activeId, items]);

	// 2. 预计算激活区域的范围 (范围: [activeSectionStart, activeSectionEnd))
	// 这样在渲染循环中只需要做简单的 index 比较，性能极佳
	const { activeParentIndex, activeSectionEndIndex } = useMemo(() => {
		if (activeIndex === -1)
			return { activeParentIndex: -1, activeSectionEndIndex: -1 };

		let parentIndex = -1;

		// 如果当前是 H2，它自己就是父级
		if (items[activeIndex].depth === 2) {
			parentIndex = activeIndex;
		} else {
			// 否则向上查找最近的 H2
			for (let i = activeIndex - 1; i >= 0; i--) {
				if (items[i].depth === 2) {
					parentIndex = i;
					break;
				}
			}
		}

		// 如果没找到父级（比如第一个标题就是 H3），则没有激活区域
		if (parentIndex === -1)
			return { activeParentIndex: -1, activeSectionEndIndex: -1 };

		// 查找当前区域的结束位置（下一个 H2 的位置或列表末尾）
		let endIndex = items.length;
		for (let i = parentIndex + 1; i < items.length; i++) {
			if (items[i].depth === 2) {
				endIndex = i;
				break;
			}
		}

		return { activeParentIndex: parentIndex, activeSectionEndIndex: endIndex };
	}, [activeIndex, items]);

	// 滚动逻辑保持不变，但依赖更稳定的 activeId
	const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!isAutoScrollEnabled || !activeId || !tocRef.current)
			return;

		if (scrollTimeoutRef.current)
			clearTimeout(scrollTimeoutRef.current);

		scrollTimeoutRef.current = setTimeout(() => {
			const activeLink = document.getElementById(`toc-link-${activeId}`);
			if (activeLink && tocRef.current) {
				const container = tocRef.current;
				const relativeTop = activeLink.offsetTop;
				const targetScroll = relativeTop - container.clientHeight / 2 + activeLink.clientHeight / 2;

				requestAnimationFrame(() => {
					container.scrollTo({ top: targetScroll, behavior: "smooth" });
				});
			}
		}, 150);

		return () => {
			if (scrollTimeoutRef.current)
				clearTimeout(scrollTimeoutRef.current);
		};
	}, [activeId, isAutoScrollEnabled]);

	if (items.length === 0)
		return null;

	const isShortTOC = items.length <= 8;

	const handleClick = (e: React.MouseEvent, id: string) => {
		e.preventDefault();
		scrollToCenter(id);
	};

	return (
		<div className={className}>
			<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 px-2">
				Table of Contents
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
					<style>{`nav::-webkit-scrollbar { display: none; }`}</style>

					<ul className={`space-y-0.5 ${isShortTOC ? "" : "pb-10"}`}>
						{items.map((item, index) => {
							const isActive = index === activeIndex;
							const isH2 = item.depth === 2;

							// 判断是否是当前激活区域的 H2 标题
							const isActiveParent = index === activeParentIndex;

							// 判断是否在当前激活区域内（不包含 H2 自身）
							const inActiveSection
								= !isH2
									&& index > activeParentIndex
									&& index < activeSectionEndIndex;

							return (
								<li key={item.id}>
									<motion.a
										id={`toc-link-${item.id}`}
										href={`#${item.id}`}
										onClick={e => handleClick(e, item.id)}
										className={`
                      flex items-center py-1 px-2.5 rounded-md relative cursor-pointer origin-left transition-colors duration-200
                      ${isH2 ? "font-medium text-xs" : "pl-5 text-[11px]"}
                      ${
								isActive
									? "text-foreground font-semibold"
									: isActiveParent
										? "text-foreground font-medium"
										: inActiveSection
											? "text-foreground/90 font-medium"
											: "text-muted-foreground/70 hover:text-foreground hover:bg-accent/20"
								}
                    `}
										// 使用 animate 属性直接控制样式，比 AnimatePresence 更稳定
										animate={{
											backgroundColor: isActive
												? "rgba(var(--accent-rgb), 0.4)"
												: inActiveSection
													? "rgba(var(--accent-rgb), 0.08)"
													: "rgba(0, 0, 0, 0)",
											scale: isH2
												? isActive || isActiveParent
													? 1.05
													: 1
												: isActive
													? 1.08
													: inActiveSection
														? 1.02
														: 1,
											opacity: !isActive && !isActiveParent && !inActiveSection ? 0.6 : 1,
										}}
										transition={{ duration: 0.15, ease: "easeOut" }}
									>
										{/*
                       3. 彻底消除闪烁的关键：
                       移除 AnimatePresence，让指示器始终存在，
                       只通过 opacity 和 scale 动画来显示/隐藏。
                       这样 DOM 结构不会变动，不会触发布局重算。
                    */}

										{/* 左侧激活色条 (Active Item) */}
										<motion.span
											className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 bg-accent-600 rounded-r-full"
											initial={false}
											animate={{
												opacity: isActive ? 1 : 0,
												height: isActive ? "75%" : "0%",
											}}
											transition={{ duration: 0.2 }}
										/>

										{/* 父级 H2 的侧边指示条 (Active Parent) */}
										<motion.span
											className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 bg-accent-500 rounded-r-full"
											initial={false}
											animate={{
												opacity: isActiveParent && !isActive ? 0.7 : 0,
												height: isActiveParent && !isActive ? "70%" : "0%",
											}}
											transition={{ duration: 0.2 }}
										/>

										{/* 激活区域内子节点的侧边指示点 (In Section) */}
										<motion.span
											className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 bg-accent-400 rounded-full"
											initial={false}
											animate={{
												opacity: inActiveSection && !isActive ? 0.6 : 0,
												scale: inActiveSection && !isActive ? 1 : 0,
											}}
											transition={{ duration: 0.2 }}
										/>

										<span className="truncate relative z-10">{item.title}</span>
									</motion.a>
								</li>
							);
						})}
					</ul>
				</nav>

				{!isShortTOC && (
					<div className="absolute bottom-0 left-0 w-full h-10 bg-linear-to-t from-background via-background/80 to-transparent pointer-events-none z-10" />
				)}
			</div>
		</div>
	);
}
