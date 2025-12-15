/**
 * 日期工具函数 - 时区感知的日期处理
 * 使用 date-fns + date-fns-tz 进行时区安全的日期转换与计算
 */

import {
	differenceInDays,
	formatDistanceToNow,
	getYear,
	isValid,
	parseISO,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { zhCN } from "date-fns/locale";

// 应用级时区配置 - 可根据需要修改或从配置文件读取
export const APP_TIMEZONE = "Asia/Shanghai";

/**
 * 将日期转换为应用时区的 Date 对象
 */
export function toAppTimezone(date: Date | string | number): Date {
	const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);
	if (!isValid(parsedDate)) {
		throw new Error("Invalid date provided");
	}
	return toZonedTime(parsedDate, APP_TIMEZONE);
}

/**
 * 在应用时区内格式化日期
 */
export function formatInAppTimezone(
	date: Date | string | number,
	formatStr: string,
): string {
	const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);
	if (!isValid(parsedDate)) {
		return "无效日期";
	}
	return formatInTimeZone(parsedDate, APP_TIMEZONE, formatStr, {
		locale: zhCN,
	});
}

/**
 * 获取相对时间描述（如"2 天前"）
 */
export function getRelativeTime(date: Date | string | number): string {
	const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);
	if (!isValid(parsedDate)) {
		return "无效日期";
	}
	return formatDistanceToNow(parsedDate, {
		addSuffix: true,
		locale: zhCN,
	});
}

/**
 * 计算日期距今的天数差
 */
export function getDaysAgo(date: Date | string | number): number {
	const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);
	if (!isValid(parsedDate)) {
		return Number.POSITIVE_INFINITY;
	}
	return differenceInDays(new Date(), parsedDate);
}

/**
 * 智能格式化日期 - 年份智能显示
 * 当年日期省略年份，非当年显示两位年份
 */
export function formatSmartDate(date: Date | string | number): string {
	const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);
	if (!isValid(parsedDate)) {
		return "无效日期";
	}

	const zonedDate = toZonedTime(parsedDate, APP_TIMEZONE);
	const currentYear = getYear(toZonedTime(new Date(), APP_TIMEZONE));
	const dateYear = getYear(zonedDate);

	if (dateYear === currentYear) {
		// 当年：显示 "M月d日"
		return formatInTimeZone(parsedDate, APP_TIMEZONE, "M月d日", {
			locale: zhCN,
		});
	} else {
		// 非当年：显示 "yy年M月d日"
		return formatInTimeZone(parsedDate, APP_TIMEZONE, "yy年M月d日", {
			locale: zhCN,
		});
	}
}

/**
 * 获取完整日期时间字符串（用于 Tooltip）
 */
export function getFullDateTime(date: Date | string | number): string {
	const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);
	if (!isValid(parsedDate)) {
		return "无效日期";
	}
	return formatInTimeZone(
		parsedDate,
		APP_TIMEZONE,
		"yyyy年M月d日 HH:mm:ss",
		{ locale: zhCN },
	);
}

/**
 * 判断是否应该显示相对时间
 * @param date 日期
 * @param threshold 阈值天数，默认 7 天
 */
export function shouldShowRelative(
	date: Date | string | number,
	threshold: number = 7,
): boolean {
	return getDaysAgo(date) <= threshold;
}
