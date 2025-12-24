/**
 * CommentForm 工具函数
 */

/**
 * 解析 OwO 表情图标字符串，提取图片 URL
 */
export function parseOwOIcon(iconString: string): string {
	const match = iconString.match(/src="([^"]+)"/);
	return match && match[1]
		? (match[1].startsWith("http") ? match[1] : `https://${match[1]}`)
		: "";
}
