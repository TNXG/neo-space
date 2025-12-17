import type { Root } from "mdast";
import { visit } from "unist-util-visit";

export const remarkSpoiler = () => {
	return (tree: Root) => {
		visit(tree, "text", (node, index, parent) => {
			if (!parent || typeof node.value !== "string")
				return;

			const regex = /\|\|(.+?)\|\|/g;
			const children: Array<any> = [];
			let lastIndex = 0;

			for (let match = regex.exec(node.value); match !== null; match = regex.exec(node.value)) {
				if (match.index > lastIndex) {
					children.push({
						type: "text",
						value: node.value.slice(lastIndex, match.index),
					});
				}

				// 创建一个 HTML 节点而不是自定义节点
				children.push({
					type: "html",
					value: `<span class="spoiler">${match[1]}</span>`,
				});

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
