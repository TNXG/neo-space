import type { Element, Root, Text } from "hast";
import { SKIP, visit } from "unist-util-visit";

/**
 * 不应处理内联语法的元素：其文本内容为原始代码/脚本，不应被改写。
 */
const RAW_CONTENT_ELEMENTS = new Set(["script", "style", "code", "pre"]);

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
    });

    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || typeof node.value !== "string")
        return;

      // 再次确认父元素不是原始内容元素
      if (parent.type === "element" && RAW_CONTENT_ELEMENTS.has((parent as Element).tagName))
        return;

      const text = node.value;

      // 检查是否包含 == 或 || 语法
      if (!text.includes("==") && !text.includes("||"))
        return;

      const children: (Element | Text)[] = [];

      // 使用正则匹配 ==text== 和 ||text||
      const regex = /==([^=]+)==|\|\|([^|]+)\|\|/g;
      let lastIndex = 0;
      let match = regex.exec(text);

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

        lastIndex = regex.lastIndex;
        match = regex.exec(text);
      }

      if (children.length === 0)
        return;

      // 添加剩余文本
      if (lastIndex < text.length) {
        children.push({
          type: "text",
          value: text.slice(lastIndex),
        });
      }

      // 替换当前节点
      (parent as Element).children.splice(index!, 1, ...children);
    });
  };
};

export default rehypeInlineSyntax;
