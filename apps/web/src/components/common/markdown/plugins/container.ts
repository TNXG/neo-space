import type { Paragraph, Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";

const CONTAINER_START_REGEX = /^::: *(\w+)(?: *\{([^}]*)\})? *$/;
const CONTAINER_END_REGEX = /^::: *$/;
const CONTAINER_TYPES: Record<string, true> = {
  gallery: true, banner: true, grid: true, masonry: true, info: true, success: true,
  warn: true, error: true, warning: true, danger: true, note: true,
};

/**
 * 读取段落边界的纯文本行；代码块和图片节点不作为容器标记。
 * @param node Markdown 块
 * @param start 是否读取首行
 * @returns 边界文本
 */
const boundaryLine = (node: RootContent, start: boolean) => {
  if (node.type !== "paragraph") return "";
  const text = start ? node.children[0] : node.children.at(-1);
  if (text?.type !== "text") return "";
  return (start ? text.value.split("\n")[0] : text.value.split("\n").at(-1)) ?? "";
};

/**
 * 只移除容器标记及相邻换行，保留同一段落中的图片、格式和正文。
 * @param node 边界段落
 * @param start 是否移除首行
 * @returns 不含标记的段落副本
 */
const withoutMarker = (node: Paragraph, start: boolean): Paragraph => {
  const children = [...node.children];
  const index = start ? 0 : children.length - 1;
  const text = children[index];
  if (text?.type !== "text") return node;
  const value = text.value.replace(start ? /^[^\n]*(?:\n|$)/ : /(?:\n)?[^\n]*$/, "");
  if (value) children[index] = { ...text, value };
  else {
    children.splice(index, 1);
    if (start && children[0]?.type === "break") children.shift();
    if (!start && children.at(-1)?.type === "break") children.pop();
  }
  return { ...node, children };
};

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
    visit(tree, "paragraph", (node, index, parent) => {
      if (index === undefined || !parent) return;
      const match = CONTAINER_START_REGEX.exec(boundaryLine(node, true));
      if (!match || !Object.hasOwn(CONTAINER_TYPES, match[1])) return;

      const siblings = parent.children as RootContent[];
      const endIndex = siblings.findIndex((sibling, i) => i >= index && CONTAINER_END_REGEX.test(boundaryLine(sibling, false)));
      if (endIndex === -1) return;

      const content = siblings.slice(index, endIndex + 1);
      content[0] = withoutMarker(content[0] as Paragraph, true);
      content[content.length - 1] = withoutMarker(content.at(-1) as Paragraph, false);
      const container = {
        type: "containerBlock",
        data: {
          hName: "div",
          hProperties: {
            "data-container-type": match[1],
            "data-container-params": match[2] ?? "",
          },
        },
        children: content.filter(child => child.type !== "paragraph" || child.children.length > 0),
      };

      // 整段只替换一次，不能再次删除已移动的索引，否则会吞掉后文。
      siblings.splice(index, endIndex - index + 1, container as unknown as RootContent);
      return [SKIP, index + 1];
    });
  };
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
