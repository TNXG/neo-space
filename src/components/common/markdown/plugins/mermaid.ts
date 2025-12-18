import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Remark 插件：将 mermaid 代码块转换为自定义 HTML 节点
 * 在 Shiki 处理之前拦截，避免被高亮处理
 */
export function remarkMermaid() {
	return (tree: Root) => {
		visit(tree, "code", (node, index, parent) => {
			if (node.lang !== "mermaid" || !parent || index === undefined)
				return;

			// 将 mermaid 代码块替换为自定义 HTML 节点
			// 使用 data 属性传递原始代码
			const mermaidHtml = {
				type: "html" as const,
				value: `<div data-mermaid-chart="${encodeURIComponent(node.value)}"></div>`,
			};

			parent.children.splice(index, 1, mermaidHtml);
		});
	};
}
