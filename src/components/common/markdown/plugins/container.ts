import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Remark 插件：解析自定义容器语法
 *
 * 支持的容器类型：
 * - ::: gallery - 图片画廊
 * - ::: banner {type} - 提示横幅
 * - ::: grid {params} - 网格布局
 * - ::: masonry {params} - 瀑布流布局
 * - ::: info/success/warn/error - 快捷横幅
 */
export function remarkContainer() {
	return (tree: Root) => {
		const nodesToReplace: Array<{ index: number; parent: any; node: any }> = [];

		visit(tree, "paragraph", (node, index, parent) => {
			if (index === undefined || !parent)
				return;

			const firstChild = node.children[0];
			if (firstChild?.type !== "text")
				return;

			const text = firstChild.value;
			const containerMatch = /^::: *(\w+)(?: *\{([^}]+)\})? *$/.exec(text);

			if (!containerMatch)
				return;

			const [, containerType, params] = containerMatch;
			const supportedTypes = [
				"gallery",
				"banner",
				"grid",
				"masonry",
				"info",
				"success",
				"warn",
				"error",
				"warning",
				"danger",
				"note",
			];

			if (!supportedTypes.includes(containerType))
				return;

			// 查找容器结束标记
			const siblings = parent.children;
			let endIndex = -1;

			for (let i = index + 1; i < siblings.length; i++) {
				const sibling = siblings[i];
				if (
					sibling.type === "paragraph"
					&& sibling.children[0]?.type === "text"
					&& /^::: *$/.test(sibling.children[0].value)
				) {
					endIndex = i;
					break;
				}
			}

			if (endIndex === -1)
				return;

			// 提取容器内容
			const contentNodes = siblings.slice(index + 1, endIndex);

			// 创建自定义节点
			const containerNode = {
				type: "containerBlock",
				data: {
					hName: "div",
					hProperties: {
						"data-container-type": containerType,
						"data-container-params": params || "",
					},
				},
				children: contentNodes,
			};

			nodesToReplace.push({
				index,
				parent,
				node: containerNode,
			});

			// 标记要删除的节点
			for (let i = index + 1; i <= endIndex; i++) {
				nodesToReplace.push({
					index: i,
					parent,
					node: null,
				});
			}
		});

		// 从后往前替换，避免索引问题
		nodesToReplace.reverse();
		const processed = new Set<any>();

		for (const { index: _index, parent, node: _node } of nodesToReplace) {
			if (processed.has(parent))
				continue;

			const toRemove: number[] = [];
			const toAdd: Array<{ index: number; node: any }> = [];

			for (const item of nodesToReplace) {
				if (item.parent === parent) {
					if (item.node === null) {
						toRemove.push(item.index);
					} else {
						toAdd.push({ index: item.index, node: item.node });
					}
				}
			}

			// 删除标记的节点
			toRemove.sort((a, b) => b - a);
			for (const idx of toRemove) {
				parent.children.splice(idx, 1);
			}

			// 添加新节点
			toAdd.sort((a, b) => b.index - a.index);
			for (const { index: idx, node: newNode } of toAdd) {
				const adjustedIndex = idx - toRemove.filter(r => r < idx).length;
				parent.children.splice(adjustedIndex, 1, newNode);
			}

			// 删除标记的节点
			toRemove.sort((a, b) => b - a);
			for (const idx of toRemove) {
				parent.children.splice(idx, 1);
			}

			// 添加新节点
			toAdd.sort((a, b) => b.index - a.index);
			for (const { index: _index, node: newNode } of toAdd) {
				const adjustedIndex = _index - toRemove.filter(r => r < _index).length;
				parent.children.splice(adjustedIndex, 1, newNode);
			}

			processed.add(parent);
		}
	};
}

export function extractImagesFromMarkdown(content: string): Array<{ url: string; alt?: string }> {
	const images: Array<{ url: string; alt?: string }> = [];
	const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

	let match = imageRegex.exec(content);
	while (match !== null) {
		images.push({
			url: match[2],
			alt: match[1] || undefined,
		});
		match = imageRegex.exec(content);
	}

	return images;
}

/**
 * 解析容器参数
 * 例如：cols=2,gap=4,rows=2
 */
export function parseContainerParams(params: string): Record<string, string> {
	const result: Record<string, string> = {};
	if (!params)
		return result;

	const pairs = params.split(",");
	for (const pair of pairs) {
		const [key, value] = pair.split("=").map(s => s.trim());
		if (key && value) {
			result[key] = value;
		}
	}

	return result;
}
