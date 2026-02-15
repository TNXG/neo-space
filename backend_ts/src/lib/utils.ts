/**
 * 工具函数模块
 * 提供常用的工具函数，如 ObjectId 验证、日期格式化等
 */

import { ObjectId } from "mongodb";

// ============ ObjectId 相关 ============

/**
 * 验证字符串是否为有效的 MongoDB ObjectId
 * @param id 要验证的字符串
 * @returns 是否为有效的 ObjectId
 */
export function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

/**
 * 将字符串转换为 ObjectId
 * @param id ObjectId 字符串
 * @returns ObjectId 实例，如果无效则返回 null
 */
export function toObjectId(id: string): ObjectId | null {
  if (!isValidObjectId(id)) {
    return null;
  }
  return new ObjectId(id);
}

/**
 * 将 ObjectId 转换为字符串
 * @param id ObjectId 实例
 * @returns ObjectId 字符串
 */
export function objectIdToString(id: ObjectId): string {
  return id.toString();
}

// ============ 日期格式化 ============

/**
 * 格式化日期为 ISO 8601 字符串
 * @param date 日期对象
 * @returns ISO 8601 格式的日期字符串
 */
export function formatDateISO(date: Date): string {
  return date.toISOString();
}

/**
 * 格式化日期为本地化字符串
 * @param date 日期对象
 * @param locale 语言环境，默认为 'zh-CN'
 * @returns 本地化的日期字符串
 */
export function formatDateLocal(date: Date, locale: string = "zh-CN"): string {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 解析日期字符串
 * @param dateStr 日期字符串
 * @returns Date 对象，如果解析失败则返回 null
 */
export function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 获取当前时间戳（秒）
 * @returns Unix 时间戳（秒）
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 获取当前时间戳（毫秒）
 * @returns Unix 时间戳（毫秒）
 */
export function getCurrentTimestampMs(): number {
  return Date.now();
}

// ============ 字符串处理 ============

/**
 * 生成 slug（URL 友好的字符串）
 * @param text 原始文本
 * @returns slug 字符串
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u4E00-\u9FA5-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * 截断文本
 * @param text 原始文本
 * @param maxLength 最大长度
 * @param suffix 后缀，默认为 '...'
 * @returns 截断后的文本
 */
export function truncate(text: string, maxLength: number, suffix: string = "..."): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 移除 HTML 标签
 * @param html HTML 字符串
 * @returns 纯文本
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

// ============ 数组处理 ============

/**
 * 数组去重
 * @param arr 原始数组
 * @returns 去重后的数组
 */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * 数组分块
 * @param arr 原始数组
 * @param size 每块大小
 * @returns 分块后的二维数组
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============ 对象处理 ============

/**
 * 深度克隆对象
 * @param obj 原始对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 移除对象中的 undefined 和 null 值
 * @param obj 原始对象
 * @returns 清理后的对象
 */
export function removeNullish<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 选择对象的指定字段
 * @param obj 原始对象
 * @param keys 要选择的字段
 * @returns 包含指定字段的新对象
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result: any = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * 排除对象的指定字段
 * @param obj 原始对象
 * @param keys 要排除的字段
 * @returns 排除指定字段后的新对象
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result: any = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// ============ 验证函数 ============

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 是否为有效的邮箱
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证 URL 格式
 * @param url URL 字符串
 * @returns 是否为有效的 URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const _ = new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============ 随机生成 ============

/**
 * 生成随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
export function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机数字验证码
 * @param length 验证码长度
 * @returns 数字验证码
 */
export function randomCode(length: number = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

// ============ 延迟函数 ============

/**
 * 延迟执行
 * @param ms 延迟时间（毫秒）
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ 错误处理 ============

/**
 * 安全执行异步函数
 * @param fn 异步函数
 * @returns [error, result] 元组
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
): Promise<[Error | null, T | null]> {
  try {
    const result = await fn();
    return [null, result];
  } catch (error) {
    return [error as Error, null];
  }
}
