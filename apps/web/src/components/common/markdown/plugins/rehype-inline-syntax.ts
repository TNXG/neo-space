import type { Element, Root, Text } from "hast";
import { SKIP, visit } from "unist-util-visit";

/**
 * 不应处理内联语法的元素：其文本内容为原始代码/脚本，不应被改写。
 */
const RAW_CONTENT_ELEMENTS = new Set(["script", "style", "code", "pre"]);

// Static regex patterns to avoid re-compilation
const INLINE_SYNTAX_REGEX = /==([^=]+)==|\|\|([^|]+)\|\|/g;

/**
 * 处理单个文本节点中的内联语法
 * 返回替换后的子节点数组，如果不需要替换则返回 null
 */
function processTextNode(text: string): (Element | Text)[] | null {
  // 检查是否包含 == 或 || 语法
  if (!text.includes("==") && !text.includes("||"))
    return null;

  const children: (Element | Text)[] = [];
  let lastIndex = 0;
  let match = INLINE_SYNTAX_REGEX.exec(text);

  while (match !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      children.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      // ==mark== 语法
      children.push({
        type: "element",
        tagName: "mark",
        properties: {},
        children: [{ type: "text", value: match[1] }],
      });
    } else if (match[2]) {
      // ||spoiler|| 语法
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["spoiler"] },
        children: [{ type: "text", value: match[2] }],
      });
    }

    lastIndex = INLINE_SYNTAX_REGEX.lastIndex;
    match = INLINE_SYNTAX_REGEX.exec(text);
  }

  if (children.length === 0)
    return null;

  // 添加剩余文本
  if (lastIndex < text.length) {
    children.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return children;
}

/**
 * 递归处理元素的所有子节点
 */
function processElementChildren(element: Element): void {
  for (let i = element.children.length - 1; i >= 0; i--) {
    const child = element.children[i];

    if (child.type === "text") {
      const newChildren = processTextNode(child.value);
      if (newChildren) {
        // 替换文本节点
        element.children.splice(i, 1, ...newChildren);

        // 递归处理新创建的元素（处理嵌套语法）
        for (const newChild of newChildren) {
          if (newChild.type === "element") {
            processElementChildren(newChild);
          }
        }
      }
    } else if (child.type === "element") {
      // 递归处理子元素
      processElementChildren(child);
    }
  }
}

/**
 * Rehype 插件：处理 HTML 元素内部的 ==mark== 和 ||spoiler|| 语法
 * 用于处理 <summary>、<details> 等 HTML 标签内的自定义语法
 */
export const rehypeInlineSyntax = () => {
  return (tree: Root) => {
    visit(tree, (node) => {
      // 跳过 script / style / code / pre 及其所有子节点
      if (node.type === "element" && RAW_CONTENT_ELEMENTS.has((node as Element).tagName)) {
        return SKIP;
      }

      // 处理元素子节点
      if (node.type === "element") {
        processElementChildren(node);
      }
    });
  };
};

export default rehypeInlineSyntax;
