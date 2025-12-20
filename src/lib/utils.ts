import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
	const lt = /</g;
	const gt = />/g;
	const ap = /'/g;
	const ic = /"/g;
	return html
		.toString()
		.replaceAll(lt, "&lt;")
		.replaceAll(gt, "&gt;")
		.replaceAll(ap, "&#39;")
		.replaceAll(ic, "&#34;");
};

export const safeJsonParse = (str: string) => {
	try {
		return JSON.parse(str);
	} catch {
		return null;
	}
};
