"use client";

import type { TimeCapsuleResponse } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { useEffect, useState } from "react";
import { analyzeTimeCapsule } from "@/lib/api-client";

interface OutdatedAlertProps {
	/** 文章 ID */
	refId: string;
	/** 关联类型 */
	refType?: "post" | "note" | "page";
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
 * 结合时间判断和 AI 分析结果
 */
export function OutdatedAlert({
	refId,
	refType = "post",
	lastUpdated,
	currentDate,
	threshold = 365,
	className = "",
}: OutdatedAlertProps) {
	const [capsule, setCapsule] = useState<TimeCapsuleResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [mounted] = useState(() => typeof window !== "undefined");

	// 获取 AI 分析
	useEffect(() => {
		let cancelled = false;

		async function fetchCapsule() {
			try {
				const response = await analyzeTimeCapsule({ refId, refType });
				if (!cancelled && response.status === "success") {
					setCapsule(response.data);
				}
			} catch {
				// 静默失败
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		fetchCapsule();
		return () => {
			cancelled = true;
		};
	}, [refId, refType]);

	// 服务端渲染时不显示，避免 hydration 问题
	if (!mounted) {
		return null;
	}

	// 计算时间差
	const now = currentDate ?? new Date();
	const updated = new Date(lastUpdated);
	const diffTime = Math.abs(now.getTime() - updated.getTime());
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	const isOutdated = diffDays > threshold;

	// 计算时间描述
	const years = Math.floor(diffDays / 365);
	const months = Math.floor((diffDays % 365) / 30);
	const timeDesc = years > 0
		? `${years} 年${months > 0 ? ` ${months} 个月` : ""}`
		: `${months} 个月`;

	// 加载中显示骨架屏（仅当文章已过期时）
	if (loading && isOutdated) {
		return (
			<div className={`w-full max-w-3xl mx-auto my-8 ${className}`}>
				<div className="relative overflow-hidden rounded-xl border border-dashed border-primary-300 dark:border-primary-600 bg-primary-100/50 dark:bg-primary-200/50 backdrop-blur-sm p-1">
					<div className="relative overflow-hidden rounded-lg bg-white/60 dark:bg-primary-100/60 border border-primary-200 dark:border-primary-300 p-5 md:p-6">
						<div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center animate-pulse">
							{/* 图标骨架 */}
							<div className="shrink-0">
								<div className="w-12 h-12 rounded-xl bg-primary-200 dark:bg-primary-300" />
							</div>
							{/* 文本骨架 */}
							<div className="flex-1 space-y-3">
								<div className="flex gap-2">
									<div className="h-4 w-20 rounded bg-primary-200 dark:bg-primary-300" />
									<div className="h-4 w-16 rounded bg-primary-200 dark:bg-primary-300" />
								</div>
								<div className="h-5 w-48 rounded bg-primary-200 dark:bg-primary-300" />
								<div className="h-4 w-full max-w-md rounded bg-primary-200 dark:bg-primary-300" />
								<div className="flex gap-1.5">
									<div className="h-5 w-16 rounded bg-primary-200 dark:bg-primary-300" />
									<div className="h-5 w-20 rounded bg-primary-200 dark:bg-primary-300" />
									<div className="h-5 w-14 rounded bg-primary-200 dark:bg-primary-300" />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// 判断是否显示：时间过期 或 AI 判断为高时效性内容
	const shouldShow = isOutdated || (!loading && capsule?.sensitivity === "high");

	if (!shouldShow) {
		return null;
	}

	// AI 分析的敏感度标签
	const sensitivityLabel = capsule?.sensitivity === "high"
		? "易过期内容"
		: capsule?.sensitivity === "medium"
			? "部分时效内容"
			: capsule?.sensitivity === "low"
				? "长期有效内容"
				: null;

	return (
		<div className={`w-full max-w-3xl mx-auto my-8 ${className}`}>
			{/* 外层虚线边框容器 */}
			<div className="relative overflow-hidden rounded-xl border border-dashed border-primary-300 dark:border-primary-600 bg-primary-100/50 dark:bg-primary-200/50 backdrop-blur-sm p-1">
				{/* 内层实线容器 */}
				<div className="relative overflow-hidden rounded-lg bg-white/60 dark:bg-primary-100/60 border border-primary-200 dark:border-primary-300 p-5 md:p-6">
					{/* 背景水印 */}
					<div className="absolute -right-6 -bottom-8 text-primary-400/10 dark:text-primary-600/10 pointer-events-none select-none z-0">
						<Icon
							icon="mingcute:sandglass-line"
							width={160}
							height={160}
							className="transform -rotate-12"
						/>
					</div>

					<div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
						{/* 左侧图标 */}
						<div className="shrink-0">
							<div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-200 dark:bg-primary-300 text-primary-600 dark:text-primary-700 border border-primary-300 dark:border-primary-400 shadow-sm">
								<Icon icon="mingcute:sandglass-line" width={24} height={24} />
							</div>
						</div>

						{/* 右侧文本 */}
						<div className="flex-1 space-y-2">
							{/* 标签 */}
							<div className="flex flex-wrap items-center gap-2">
								<span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary-200 dark:bg-primary-300 text-primary-700 dark:text-primary-800 border border-primary-300 dark:border-primary-400">
									Time Capsule
								</span>
								{sensitivityLabel && (
									<span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
										capsule?.sensitivity === "high"
											? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
											: capsule?.sensitivity === "low"
												? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
												: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
									}`}
									>
										{sensitivityLabel}
									</span>
								)}
							</div>

							{/* 标题 */}
							{isOutdated
								? (
										<h4 className="text-base font-bold text-foreground">
											本文最后更新于
											{" "}
											<span className="text-accent-600 dark:text-accent-500 border-b-2 border-accent-300 dark:border-accent-600">
												{timeDesc}
											</span>
											{" "}
											前
										</h4>
									)
								: (
										<h4 className="text-base font-bold text-foreground">
											此文章包含时效性内容
										</h4>
									)}

							{/* AI 分析理由 */}
							{capsule?.reason
								? (
										<p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
											{capsule.reason}
										</p>
									)
								: (
										<p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
											文中涉及的技术方案、API 或最佳实践可能已经发生演变。
											<span className="hidden sm:inline">
												建议在阅读时结合最新的官方文档或社区动态进行验证。
											</span>
										</p>
									)}

							{/* AI 检测到的易过期元素 */}
							{capsule?.markers && capsule.markers.length > 0 && (
								<div className="flex flex-wrap gap-1.5 pt-1">
									{capsule.markers.map(marker => (
										<span
											key={marker}
											className="px-2 py-0.5 rounded text-xs bg-primary-200/80 dark:bg-primary-400/50 text-primary-700 dark:text-primary-800"
										>
											{marker}
										</span>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
