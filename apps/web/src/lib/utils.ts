import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Static regex patterns to avoid re-compilation
const LESS_THAN_REGEX = /</g;
const GREATER_THAN_REGEX = />/g;
const APOSTROPHE_REGEX = /'/g;
const QUOTE_REGEX = /"/g;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 合并 Tailwind CSS 类名，解决冲突
 */
export const clsxm = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const escapeHTMLTag = (html: string) => {
  return html
    .toString()
    .replaceAll(LESS_THAN_REGEX, "&lt;")
    .replaceAll(GREATER_THAN_REGEX, "&gt;")
    .replaceAll(APOSTROPHE_REGEX, "&#39;")
    .replaceAll(QUOTE_REGEX, "&#34;");
};

export const safeJsonParse = (str: string) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};
