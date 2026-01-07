import type { PhrasingContent, Root } from "mdast";
import { visit } from "unist-util-visit";

export const remarkSpoiler = () => {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || typeof node.value !== "string")
        return;

      const regex = /\|\|(.+?)\|\|/g;
      const children: Array<PhrasingContent> = [];
      let lastIndex = 0;

      for (let match = regex.exec(node.value); match !== null; match = regex.exec(node.value)) {
        if (match.index > lastIndex) {
          children.push({
            type: "text",
            value: node.value.slice(lastIndex, match.index),
          });
        }

        // 创建一个包含文本的 emphasis 节点，通过 data.hProperties 添加 class
        // 这样内部的文本可以继续被其他插件处理
        children.push({
          type: "emphasis",
          data: {
            hName: "span",
            hProperties: { className: "spoiler" },
          },
          children: [{ type: "text", value: match[1] }],
        } as any);

        lastIndex = regex.lastIndex;
      }

      if (children.length === 0)
        return;

      if (lastIndex < node.value.length) {
        children.push({
          type: "text",
          value: node.value.slice(lastIndex),
        });
      }

      parent.children.splice(index!, 1, ...children);
    });
  };
};

export default remarkSpoiler;
