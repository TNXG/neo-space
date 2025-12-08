"use client";

import type { ReactElement, SVGProps } from "react";
import { cn } from "@/lib/utils";

interface ActionPillProps {
	icon?: (props: SVGProps<SVGSVGElement>) => ReactElement;
	label?: string;
	onClick?: () => void;
	active?: boolean;
	ariaLabel?: string;
}

/**
 * 底部操作栏按钮组件
 * 使用纯 CSS 实现压感按钮效果，避免 JS 动画导致的抖动
 */
export function ActionPill({ icon: Icon, label, onClick, active, ariaLabel }: ActionPillProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={ariaLabel || label}
			className={cn(
				// 基础样式
				"group relative flex cursor-pointer select-none items-center justify-center gap-2 rounded-full border px-4 py-2.5 backdrop-blur-md",
				// 过渡效果 - 只对颜色和阴影过渡，不对 transform 过渡
				"transition-[background-color,border-color,box-shadow] duration-150 ease-out",
				// 焦点样式
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50",
				// 边框
				"border-gray-200/60 dark:border-white/10",
				// 按压效果 - 使用 CSS active 伪类
				"active:translate-y-px active:shadow-none",
				// 状态样式
				active
					? "bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
					: [
							"bg-gray-50/80 text-gray-600 shadow-[0_2px_4px_rgba(0,0,0,0.05)]",
							"hover:bg-gray-100 hover:text-gray-900 hover:shadow-[0_3px_8px_rgba(0,0,0,0.08)]",
							"dark:bg-gray-800/80 dark:text-gray-300 dark:shadow-[0_2px_4px_rgba(0,0,0,0.2)]",
							"dark:hover:bg-gray-700/80 dark:hover:text-white dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.3)]",
					  ],
			)}
		>
			{Icon && <Icon className="h-4 w-4" />}
			{label && <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>}
		</button>
	);
}
