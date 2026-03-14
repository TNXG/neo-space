// Static regex patterns to avoid re-compilation
const AMPERSAND_REGEX = /&/g;
const LESS_THAN_REGEX = /</g;
const GREATER_THAN_REGEX = />/g;
const MARK_TAG_OPEN_REGEX = /&lt;mark&gt;/g;
const MARK_TAG_CLOSE_REGEX = /&lt;\/mark&gt;/g;

/**
 * 安全地将包含 <mark> 标签的高亮文本渲染为 HTML
 * 只保留 <mark> 标签，转义其他所有 HTML
 */
export function sanitizeHighlight(html: string): string {
  // 先转义所有 HTML
  const escaped = html
    .replace(AMPERSAND_REGEX, "&amp;")
    .replace(LESS_THAN_REGEX, "&lt;")
    .replace(GREATER_THAN_REGEX, "&gt;");
  // 再恢复 <mark> 和 </mark>
  return escaped
    .replace(MARK_TAG_OPEN_REGEX, "<mark class=\"bg-accent/30 text-accent-foreground rounded-sm px-0.5\">")
    .replace(MARK_TAG_CLOSE_REGEX, "</mark>");
}

/**
 * 格式化时间戳
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
