/**
 * 截断文本内容
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength)
		return text;
	return `${text.slice(0, maxLength)}...`;
}
