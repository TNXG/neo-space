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
