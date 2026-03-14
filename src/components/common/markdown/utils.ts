import type { ReactNode } from "react";
import { isValidElement } from "react";

// Static regex patterns to avoid re-compilation
const HEADING_MARKER_REGEX = /^#{1,6}\s+/gm;
const BOLD_ASTERISK_REGEX = /\*\*(.*?)\*\*/g;
const ITALIC_ASTERISK_REGEX = /\*(.*?)\*/g;
const BOLD_UNDERSCORE_REGEX = /__(.*?)__/g;
const ITALIC_UNDERSCORE_REGEX = /_(.*?)_/g;
const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;
const LINK_REGEX = /\[([^\]]+)\]\([^)]+\)/g;
const IMAGE_REGEX = /!\[([^\]]*)\]\([^)]+\)/g;
const BLOCKQUOTE_REGEX = /^>\s+/gm;
const UNORDERED_LIST_REGEX = /^\s*[-*+]\s+/gm;
const ORDERED_LIST_REGEX = /^\s*\d+\.\s+/gm;
const MULTIPLE_NEWLINES_REGEX = /\n\s*\n/g;

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
    .replace(HEADING_MARKER_REGEX, "")
  // 移除粗体和斜体
    .replace(BOLD_ASTERISK_REGEX, "$1")
    .replace(ITALIC_ASTERISK_REGEX, "$1")
    .replace(BOLD_UNDERSCORE_REGEX, "$1")
    .replace(ITALIC_UNDERSCORE_REGEX, "$1")
  // 移除代码块
    .replace(CODE_BLOCK_REGEX, "[代码块]")
    .replace(INLINE_CODE_REGEX, "$1")
  // 移除链接，保留文本
    .replace(LINK_REGEX, "$1")
  // 移除图片
    .replace(IMAGE_REGEX, "[图片: $1]")
  // 移除引用标记
    .replace(BLOCKQUOTE_REGEX, "")
  // 移除列表标记
    .replace(UNORDERED_LIST_REGEX, "• ")
    .replace(ORDERED_LIST_REGEX, "")
  // 移除多余的空行
    .replace(MULTIPLE_NEWLINES_REGEX, "\n")
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
    return node.reduce<ReactNode[]>((acc, child) => [...acc, ...flattenNodeToArray(child)], []);
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

    // 检查是否为原始 img 标签
    if (isValidElement(onlyChild) && onlyChild.type === "img") {
      const { src, alt } = (onlyChild.props ?? {}) as { src?: string; alt?: string };
      if (typeof src === "string" && src.length > 0)
        return { src, alt };
    }

    // 检查是否为 ImageFigure 组件（通过函数名或 displayName）
    if (isValidElement(onlyChild)) {
      const type = onlyChild.type as any;
      const isImageFigure
        = type?.name === "ImageFigure"
          || type?.displayName === "ImageFigure"
          || (typeof type === "function" && type.toString().includes("ImageFigure"));

      if (isImageFigure) {
        const props = onlyChild.props as any;
        return { src: props.src, alt: props.alt };
      }
    }
  }
  return null;
};
