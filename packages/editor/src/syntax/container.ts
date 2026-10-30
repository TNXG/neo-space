import type { Root, RootContent } from "mdast";
import { $ctx, $nodeSchema, $remark, $view } from "@milkdown/kit/utils";
import { createSourceView } from "./source-view";

const CONTAINER_START = /^::: *(\w+)(?: *\{([^}]*)\})? *$/;
const CONTAINER_END = /^::: *$/;

interface ContainerNode {
  type: "siteContainer";
  kind: string;
  params: string;
  value: string;
}

/**
 * 读取段落首行纯文本；容器标记一定独占段落首行。
 * @param node mdast 节点
 * @returns 首个文本子节点的值
 */
const firstLine = (node: RootContent): string | null => {
  if (node.type !== "paragraph") return null;
  const head = node.children[0];
  return head?.type === "text" ? head.value.split("\n")[0] : null;
};

/**
 * 读取段落末行，允许结束标记紧跟图片或正文而不额外插入空行。
 * @param node mdast 节点
 * @returns 最后一个文本子节点的末行
 */
const lastLine = (node: RootContent): string | null => {
  if (node.type !== "paragraph") return null;
  const tail = node.children.at(-1);
  return tail?.type === "text" ? tail.value.split("\n").at(-1) ?? null : null;
};

/**
 * 依据源码位置截取容器内原文，确保往返序列化不丢失任何站点私有语法。
 * @param source 原始 Markdown
 * @returns remark 转换器
 */
const remarkContainer = () => (tree: Root, file: { value?: unknown }) => {
  const source = typeof file.value === "string" ? file.value : "";
  const children = tree.children;
  for (let index = 0; index < children.length; index++) {
    const match = CONTAINER_START.exec(firstLine(children[index]) ?? "");
    if (!match) continue;
    const end = children.findIndex((node, i) => i >= index && CONTAINER_END.test((lastLine(node) ?? "").trim()));
    if (end === -1) continue;

    const startOffset = children[index].position?.start.offset;
    const endOffset = children[end].position?.end.offset;
    if (startOffset === undefined || endOffset === undefined) continue;
    const raw = source.slice(startOffset, endOffset);
    const body = raw.split("\n").slice(1, -1).join("\n");

    const node: ContainerNode = { type: "siteContainer", kind: match[1], params: match[2] ?? "", value: body.trim() };
    children.splice(index, end - index + 1, node as unknown as RootContent);
  }
};

/**
 * 原样输出容器，参数为空时不追加花括号。
 * @returns remark-stringify 扩展
 */
function stringifyContainer(this: { data: () => Record<string, unknown[]> }) {
  const extensions = (this.data().toMarkdownExtensions ??= []);
  extensions.push({
    handlers: {
      siteContainer: (node: ContainerNode) => `::: ${node.kind}${node.params ? ` {${node.params}}` : ""}\n${node.value}\n:::`,
    },
  });
}

export const remarkContainerPlugin = $remark("siteContainer", () => function (this: unknown) {
  stringifyContainer.call(this as never);
  return remarkContainer();
});

export const containerSchema = $nodeSchema("site_container", () => ({
  group: "block",
  atom: true,
  isolating: true,
  marks: "",
  selectable: true,
  draggable: true,
  attrs: { kind: { default: "info" }, params: { default: "" }, value: { default: "" } },
  parseDOM: [{
    tag: "div[data-container-kind]",
    getAttrs: dom => ({
      kind: (dom as HTMLElement).dataset.containerKind,
      params: (dom as HTMLElement).dataset.containerParams ?? "",
      value: (dom as HTMLElement).dataset.value ?? "",
    }),
  }],
  toDOM: node => ["div", { "data-container-kind": node.attrs.kind, "data-container-params": node.attrs.params, "data-value": node.attrs.value }],
  parseMarkdown: {
    match: node => node.type === "siteContainer",
    runner: (state, node, type) => {
      const container = node as unknown as ContainerNode;
      state.addNode(type, { kind: container.kind, params: container.params, value: container.value });
    },
  },
  toMarkdown: {
    match: node => node.type.name === "site_container",
    runner: (state, node) => {
      state.addNode("siteContainer", undefined, undefined, { kind: node.attrs.kind, params: node.attrs.params, value: node.attrs.value });
    },
  },
}));

/** 宿主应用注入的预览渲染器；未注入时退化为纯文本展示。 */
export type BlockPreviewRenderer = (host: HTMLElement, markdown: string) => void | (() => void);
export const blockPreviewCtx = $ctx<{ render?: BlockPreviewRenderer }, "siteBlockPreview">({}, "siteBlockPreview");

/**
 * 还原单个容器的完整 Markdown，交给站点渲染器渲染出与前台完全一致的效果。
 * @param attrs 节点属性
 * @returns 容器源码
 */
export const containerMarkdown = (attrs: Record<string, unknown>) =>
  `::: ${String(attrs.kind)}${attrs.params ? ` {${String(attrs.params)}}` : ""}\n${String(attrs.value)}\n:::`;

const CONTAINER_LABELS: Record<string, string> = {
  gallery: "画廊", banner: "横幅", grid: "网格", masonry: "瀑布流", info: "信息", success: "成功", warn: "警告", warning: "警告", error: "错误", danger: "危险", note: "备注",
};

export const containerView = $view(containerSchema.node, ctx => createSourceView({
  label: node => `容器 · ${CONTAINER_LABELS[node.attrs.kind as string] ?? node.attrs.kind}`,
  placeholder: "容器内容，支持 Markdown",
  read: node => containerMarkdown(node.attrs),
  write: (node, source) => {
    const lines = source.split("\n");
    const head = /^::: *(\w+)(?: *\{([^}]*)\})? *$/.exec(lines[0] ?? "");
    const closed = lines.length > 1 && /^::: *$/.test(lines.at(-1) ?? "");
    if (!head) return { value: source };
    return { kind: head[1], params: head[2] ?? "", value: lines.slice(1, closed ? -1 : undefined).join("\n") };
  },
  render: (host, node) => {
    const render = ctx.get(blockPreviewCtx.key).render;
    if (render) return render(host, containerMarkdown(node.attrs));
    host.textContent = String(node.attrs.value);
  },
}));

export const containerPlugins = [remarkContainerPlugin, containerSchema, blockPreviewCtx, containerView].flat();
