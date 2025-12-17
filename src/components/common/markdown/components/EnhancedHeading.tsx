"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTOCStore } from "@/lib/stores/toc-store";

interface EnhancedHeadingProps {
	id?: string;
	level: 1 | 2 | 3 | 4;
	children: ReactNode;
	className: string;
}

const levelLabels = {
	1: "H1",
	2: "H2",
	3: "H3",
	4: "H4",
} as const;

/**
 * 增强的标题组件
 * 特性：
 * - 左侧激活色条（与 TOC 同步）
 * - 右侧显示标题级别和锚点链接
 * - 点击 # 滚动到页面中心
 */
export function EnhancedHeading({ id, level, children, className }: EnhancedHeadingProps) {
	const { activeId, scrollToCenter } = useTOCStore();
	const isActive = activeId === id;
	const Tag = `h${level}` as const;

	if (!id) {
		return <Tag className={className}>{children}</Tag>;
	}

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		scrollToCenter(id);
	};

	return (
		<motion.div
			className="relative group"
			initial={false}
			animate={{ x: isActive ? 6 : 0 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			{/* 左侧激活色条 */}
			<AnimatePresence>
				{isActive && (
					<motion.span
						key={`indicator-${id}`}
						initial={{ opacity: 0, scaleY: 0 }}
						animate={{ opacity: 1, scaleY: 1 }}
						exit={{ opacity: 0, scaleY: 0 }}
						transition={{ duration: 0.3 }}
						className="absolute -left-4 top-0 w-1 bg-accent-600 rounded-full origin-top"
						style={{ height: "100%" }}
					/>
				)}
			</AnimatePresence>

			<Tag id={id} className={className}>
				<span className="flex items-center justify-between gap-2 w-full">
					<span className="flex items-center gap-3">
						<span>{children}</span>
						<span
							className={`
								text-[10px] font-mono tracking-wider transition-colors duration-300
								${isActive ? "text-muted-foreground" : "text-muted-foreground/40"}
							`}
						>
							{levelLabels[level]}
						</span>
					</span>

					{/* 锚点链接 */}
					<a
						href={`#${id}`}
						onClick={handleClick}
						className={`
							text-base font-sans font-bold transition-all duration-300 shrink-0
							${isActive
			? "text-accent-600 hover:text-accent-700"
			: "text-muted-foreground/30 hover:text-muted-foreground/60"}
							opacity-0 group-hover:opacity-100
						`}
						aria-label={`跳转到 ${children}`}
					>
						#
					</a>
				</span>
			</Tag>
		</motion.div>
	);
}
