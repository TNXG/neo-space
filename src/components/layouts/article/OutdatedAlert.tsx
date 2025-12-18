"use client";

// ========================================================================
// 核心图标：Time/Hourglass SVG
// ========================================================================
function TimeIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			{...props}
		>
			<path
				fill="currentColor"
				d="M6 2h12v6l-4 4 4 4v6H6v-6l4-4-4-4V2zm10 14.5l-4-4-4 4V20h8v-3.5zm-4-5.5l4-4V4H8v2.5l4 4z"
			/>
		</svg>
	);
}

// ========================================================================
// 组件逻辑
// ========================================================================

interface OutdatedAlertProps {
	/** 最后更新时间 (ISO Date string) */
	lastUpdated: string;
	/** 当前日期（用于测试，可选） */
	currentDate?: Date;
	/** 过期阈值（天数），默认 365 天 */
	threshold?: number;
	/** 额外的 CSS 类名 */
	className?: string;
}

/**
 * 文章过期提示组件 - Time Capsule 风格
 */
export function OutdatedAlert({
	lastUpdated,
	currentDate,
	threshold = 365,
	className = "",
}: OutdatedAlertProps) {
	const now = currentDate ?? new Date();
	const updated = new Date(lastUpdated);
	const diffTime = Math.abs(now.getTime() - updated.getTime());
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	const isOutdated = diffDays > threshold;

	// 未过期则不渲染
	if (!isOutdated)
		return null;

	// 计算时间描述
	const years = Math.floor(diffDays / 365);
	const months = Math.floor((diffDays % 365) / 30);

	const timeDesc
		= years > 0
			? `${years} 年${months > 0 ? ` ${months} 个月` : ""}`
			: `${months} 个月`;

	return (
		<div className={`w-full max-w-3xl mx-auto my-8 ${className}`}>
			{/* 外层虚线边框容器 */}
			<div className="relative overflow-hidden rounded-xl border border-dashed border-primary-300 dark:border-primary-600 bg-primary-100/50 dark:bg-primary-200/50 backdrop-blur-sm p-1">
				{/* 内层实线容器 */}
				<div className="relative overflow-hidden rounded-lg bg-white/60 dark:bg-primary-100/60 border border-primary-200 dark:border-primary-300 p-5 md:p-6">
					{/* 背景水印 */}
					<div className="absolute -right-6 -bottom-8 text-primary-400/10 dark:text-primary-600/10 pointer-events-none select-none z-0">
						<TimeIcon
							width={160}
							height={160}
							className="transform -rotate-12"
						/>
					</div>

					<div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
						{/* 左侧图标 */}
						<div className="shrink-0">
							<div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-200 dark:bg-primary-300 text-primary-600 dark:text-primary-700 border border-primary-300 dark:border-primary-400 shadow-sm">
								<TimeIcon width={24} height={24} />
							</div>
						</div>

						{/* 右侧文本 */}
						<div className="flex-1 space-y-2">
							{/* 标签 */}
							<div className="flex flex-wrap items-center gap-2">
								<span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary-200 dark:bg-primary-300 text-primary-700 dark:text-primary-800 border border-primary-300 dark:border-primary-400">
									Time Capsule
								</span>
							</div>

							{/* 标题 */}
							<h4 className="text-base font-bold text-foreground">
								本文最后更新于
								{" "}
								<span className="text-accent-600 dark:text-accent-500 border-b-2 border-accent-300 dark:border-accent-600">
									{timeDesc}
								</span>
								{" "}
								前
							</h4>

							{/* 描述 */}
							<p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
								文中涉及的技术方案、API 或最佳实践可能已经发生演变。
								<span className="hidden sm:inline">
									建议在阅读时结合最新的官方文档或社区动态进行验证。
								</span>
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
