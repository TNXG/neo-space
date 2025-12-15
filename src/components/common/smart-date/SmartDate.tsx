"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	formatSmartDate,
	getFullDateTime,
	getRelativeTime,
	shouldShowRelative,
} from "@/lib/date";
import { cn } from "@/lib/utils";

export type DateDisplayMode = "auto" | "absolute" | "relative";

export interface SmartDateProps {
	/** 日期值 - 支持 Date、ISO 字符串或时间戳 */
	date: Date | string | number;
	/** 显示模式：auto（自动切换）、absolute（强制绝对时间）、relative（强制相对时间） */
	mode?: DateDisplayMode;
	/** 相对时间阈值（天数），默认 7 天 */
	threshold?: number;
	/** 前缀文本 */
	prefix?: ReactNode;
	/** 后缀文本 */
	suffix?: ReactNode;
	/** 自定义类名 */
	className?: string;
	/** 是否显示 Tooltip */
	showTooltip?: boolean;
}

/**
 * 智能日期组件
 *
 * 核心逻辑：
 * - 默认 7 天内显示相对时间（如"2 天前"）
 * - 超过 7 天显示绝对日期（如"1月15日"）
 * - 支持通过 mode prop 强制 absolute 或 relative 模式
 * - 年份智能显示：当年省略年份，非当年显示两位年份
 * - 完整日期时间通过 Tooltip 展示
 * - 使用原生 <time> 标签提升可访问性与 SEO
 */
export function SmartDate({
	date,
	mode = "auto",
	threshold = 7,
	prefix,
	suffix,
	className,
	showTooltip = true,
}: SmartDateProps) {
	const { displayText, fullDateTime, isoString } = useMemo(() => {
		const parsedDate
			= typeof date === "string"
				? new Date(date)
				: date instanceof Date
					? date
					: new Date(date);

		const iso = parsedDate.toISOString();
		const full = getFullDateTime(date);

		let text: string;
		switch (mode) {
			case "absolute":
				text = formatSmartDate(date);
				break;
			case "relative":
				text = getRelativeTime(date);
				break;
			case "auto":
			default:
				text = shouldShowRelative(date, threshold)
					? getRelativeTime(date)
					: formatSmartDate(date);
				break;
		}

		return {
			displayText: text,
			fullDateTime: full,
			isoString: iso,
		};
	}, [date, mode, threshold]);

	const timeElement = (
		<time
			dateTime={isoString}
			className={cn(
				"inline-flex items-center gap-1",
				showTooltip && "cursor-help",
				className,
			)}
		>
			{prefix && <span className="smart-date-prefix">{prefix}</span>}
			<span className="smart-date-text">{displayText}</span>
			{suffix && <span className="smart-date-suffix">{suffix}</span>}
		</time>
	);

	if (!showTooltip) {
		return timeElement;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{timeElement}</TooltipTrigger>
			<TooltipContent side="top">{fullDateTime}</TooltipContent>
		</Tooltip>
	);
}

export default SmartDate;
