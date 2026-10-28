// ==================== Markdown 清洗 ====================

const FENCED_CODE_REGEX = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const MATH_BLOCK_REGEX = /\$\$[\s\S]*?\$\$/g;
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/gi;
const SPOILER_REGEX = /\|\|[^|]+\|\|/g;
const IMAGE_REGEX = /!\[[^\]]*\]\([^)]*\)/g;
const LINK_REGEX = /\[([^\]]+)\]\([^)]*\)/g;
const FOOTNOTE_REF_REGEX = /\[\^[^\]]+\]/g;
const FOOTNOTE_DEF_REGEX = /^\[\^[^\]]+\]:.*$/gm;
const CONTAINER_FENCE_REGEX = /^\s*:{3,}.*$/gm;
const HEADING_REGEX = /^\s{0,3}#{1,6}\s+/gm;
const BLOCKQUOTE_REGEX = /^\s*>+\s?/gm;
const LIST_MARKER_REGEX = /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ x]\]\s+)?/gim;
const TABLE_RULE_REGEX = /^\s*\|?\s*:?-{3,}.*$/gm;
const HORIZONTAL_RULE_REGEX = /^\s*(?:[-*_]\s*){3,}$/gm;
const INLINE_CODE_REGEX = /`([^`]+)`/g;
const EMPHASIS_REGEX = /(\*\*|__|\*|_|~~|==)(\S(?:.*?\S)?)\1/g;
const TABLE_PIPE_REGEX = /\s*\|\s*/g;
const WHITESPACE_REGEX = /\s+/g;
const SPACE_BEFORE_PUNCTUATION_REGEX = / ([，。！？；：、,.!?;:])/g;
const SENTENCE_END_REGEX = /[。！？!?.；;]/g;

/** 搜索引擎摘要通常展示 120~160 字符，中文约 80 字左右即被截断 */
const MAX_DESCRIPTION_LENGTH = 150;

/**
 * 将 Markdown 正文转换为适合 meta description 的单行纯文本
 * @param markdown - Markdown 原文
 * @returns 去除语法标记、剧透与代码后的纯文本
 */
export const markdownToPlainText = (markdown: string): string =>
  markdown
    .replace(FENCED_CODE_REGEX, " ")
    .replace(MATH_BLOCK_REGEX, " ")
    .replace(HTML_COMMENT_REGEX, " ")
    .replace(HTML_TAG_REGEX, " ")
    // 剧透内容不应暴露在搜索结果里
    .replace(SPOILER_REGEX, "")
    .replace(IMAGE_REGEX, " ")
    .replace(LINK_REGEX, "$1")
    .replace(FOOTNOTE_DEF_REGEX, " ")
    .replace(FOOTNOTE_REF_REGEX, "")
    .replace(CONTAINER_FENCE_REGEX, " ")
    .replace(HEADING_REGEX, "")
    .replace(BLOCKQUOTE_REGEX, "")
    .replace(LIST_MARKER_REGEX, "")
    .replace(TABLE_RULE_REGEX, " ")
    .replace(HORIZONTAL_RULE_REGEX, " ")
    .replace(INLINE_CODE_REGEX, "$1")
    .replace(EMPHASIS_REGEX, "$2")
    .replace(TABLE_PIPE_REGEX, " ")
    .replace(WHITESPACE_REGEX, " ")
    .replace(SPACE_BEFORE_PUNCTUATION_REGEX, "$1")
    .trim();

/**
 * 截断文本，优先在句末标点处断开，避免摘要停在半句话
 * @param text - 纯文本
 * @param maxLength - 最大长度
 * @returns 截断后的文本
 */
export const truncateDescription = (text: string, maxLength = MAX_DESCRIPTION_LENGTH): string => {
  const chars = Array.from(text);
  if (chars.length <= maxLength)
    return text;

  const head = chars.slice(0, maxLength).join("");
  let lastSentenceEnd = -1;
  for (const match of head.matchAll(SENTENCE_END_REGEX))
    lastSentenceEnd = match.index + match[0].length;

  // 句末位置过于靠前时宁可硬截断，保证摘要信息量
  if (lastSentenceEnd >= head.length * 0.6)
    return head.slice(0, lastSentenceEnd);
  return `${chars.slice(0, maxLength - 1).join("")}…`;
};

// ==================== 描述生成 ====================

interface SeoDescriptionSource {
  /** AI 生成的摘要，存在时优先使用并加注 AI 标识 */
  aiSummary?: string;
  /** 作者手写摘要 */
  summary?: string;
  /** Markdown 正文，作为最后兜底 */
  text: string;
  /** 将 AI 摘要包装为带声明的文本，例如 `AI 摘要：...` */
  formatAiSummary: (summary: string) => string;
}

/**
 * 生成页面 meta description
 * 优先级：AI 摘要（注明为 AI 生成）> 手写摘要 > 正文清洗截断
 * @param source - 摘要来源
 * @returns 适合 description / og:description 的文本
 */
export const buildSeoDescription = ({ aiSummary, summary, text, formatAiSummary }: SeoDescriptionSource): string => {
  const aiText = aiSummary ? markdownToPlainText(aiSummary) : "";
  if (aiText)
    return truncateDescription(formatAiSummary(aiText));

  const summaryText = summary ? markdownToPlainText(summary) : "";
  return truncateDescription(summaryText || markdownToPlainText(text));
};
