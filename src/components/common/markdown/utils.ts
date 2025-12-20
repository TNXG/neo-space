import type { ReactNode } from "react";
import { isValidElement } from "react";

/**
 * 截断文本内容
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength)
		return text;
	return `${text.slice(0, maxLength)}...`;
}

/**
 * 简单的客户端 Markdown 清理函数
 * 移除常见的 Markdown 语法，保留纯文本用于预览
 */
export function stripMarkdown(text: string): string {
	return text
		// 移除标题标记
		.replace(/^#{1,6}\s+/gm, "")
		// 移除粗体和斜体
		.replace(/\*\*(.*?)\*\*/g, "$1")
		.replace(/\*(.*?)\*/g, "$1")
		.replace(/__(.*?)__/g, "$1")
		.replace(/_(.*?)_/g, "$1")
		// 移除代码块
		.replace(/```[\s\S]*?```/g, "[代码块]")
		.replace(/`([^`]+)`/g, "$1")
		// 移除链接，保留文本
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		// 移除图片
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "[图片: $1]")
		// 移除引用标记
		.replace(/^>\s+/gm, "")
		// 移除列表标记
		.replace(/^\s*[-*+]\s+/gm, "• ")
		.replace(/^\s*\d+\.\s+/gm, "")
		// 移除多余的空行
		.replace(/\n\s*\n/g, "\n")
		// 移除首尾空白
		.trim();
}

export const isTextOnlyContent = (node: ReactNode): boolean => {
	if (node === null || node === undefined || typeof node === "boolean")
		return true;
	if (typeof node === "string" || typeof node === "number")
		return true;
	if (Array.isArray(node))
		return node.every(child => isTextOnlyContent(child));
	if (isValidElement(node))
		return false;
	return true;
};

const flattenNodeToArray = (node: ReactNode): ReactNode[] => {
	if (node === null || node === undefined || typeof node === "boolean")
		return [];
	if (Array.isArray(node))
		return node.reduce<ReactNode[]>((acc, child) => acc.concat(flattenNodeToArray(child)), []);
	return [node];
};

export const getStandaloneImageProps = (node: ReactNode): { src: string; alt?: string } | null => {
	const nodes = flattenNodeToArray(node);
	const meaningfulNodes = nodes.filter((child) => {
		if (child === null || child === undefined || typeof child === "boolean")
			return false;
		if (typeof child === "string")
			return child.trim().length > 0;
		return true;
	});

	if (meaningfulNodes.length === 1) {
		const onlyChild = meaningfulNodes[0];
		if (isValidElement(onlyChild) && onlyChild.type === "img") {
			const { src, alt } = (onlyChild.props ?? {}) as { src?: string; alt?: string };
			if (typeof src === "string" && src.length > 0)
				return { src, alt };
		}
		if (isValidElement(onlyChild) && (onlyChild.type as any).name === "ImageFigure") {
			const props = onlyChild.props as any;
			return { src: props.src, alt: props.alt };
		}
	}
	return null;
};
