"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

interface BannerProps {
	type: "info" | "success" | "warn" | "error";
	children: ReactNode;
	className?: string;
}

const bannerStyles = {
	info: {
		container: "bg-blue-50/80 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
		icon: "text-blue-600 dark:text-blue-400",
		iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
	},
	success: {
		container: "bg-green-50/80 border-green-200 dark:bg-green-950/30 dark:border-green-800",
		icon: "text-green-600 dark:text-green-400",
		iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
	},
	warn: {
		container: "bg-yellow-50/80 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
		icon: "text-yellow-600 dark:text-yellow-400",
		iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
	},
	error: {
		container: "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-800",
		icon: "text-red-600 dark:text-red-400",
		iconPath: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
	},
};

/**
 * Banner 组件 - 用于显示提示、警告、错误等信息
 */
export function Banner({ type, children, className }: BannerProps) {
	const style = bannerStyles[type];

	return (
		<div
			className={clsx(
				"relative my-6 rounded-2xl border-2 backdrop-blur-sm p-4 flex gap-3",
				style.container,
				className,
			)}
		>
			<div className="shrink-0 mt-0.5">
				<svg
					className={clsx("w-5 h-5", style.icon)}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d={style.iconPath}
					/>
				</svg>
			</div>
			<div className="flex-1 min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
				{children}
			</div>
		</div>
	);
}
