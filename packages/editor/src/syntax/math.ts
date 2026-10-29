import katex from "katex";
import remarkMath from "remark-math";
import { $nodeSchema, $remark, $view } from "@milkdown/kit/utils";
import { createSourceView } from "./source-view";

export const remarkMathPlugin = $remark("siteRemarkMath", () => remarkMath);

/**
 * 把公式渲染进宿主元素；错误时保留源码，作者能看到哪里写错了。
 * @param host 容器
 * @param value TeX 源码
 * @param displayMode 是否块级
 */
export const renderTex = (host: HTMLElement, value: string, displayMode: boolean) => {
  if (!value.trim()) {
    host.textContent = displayMode ? "空公式" : "∅";
    host.dataset.empty = "true";
    return;
  }
  delete host.dataset.empty;
  try {
    katex.render(value, host, { displayMode, throwOnError: false, strict: false, output: "html" });
  } catch {
    host.textContent = value;
  }
};

export const mathInlineSchema = $nodeSchema("math_inline", () => ({
  group: "inline",
  inline: true,
  atom: true,
  attrs: { value: { default: "" } },
  parseDOM: [{ tag: "span[data-math-inline]", getAttrs: dom => ({ value: (dom as HTMLElement).dataset.value ?? "" }) }],
  toDOM: node => ["span", { "data-math-inline": "", "data-value": node.attrs.value }],
  parseMarkdown: {
    match: node => node.type === "inlineMath",
    runner: (state, node, type) => { state.addNode(type, { value: node.value as string }); },
  },
  toMarkdown: {
    match: node => node.type.name === "math_inline",
    runner: (state, node) => { state.addNode("inlineMath", undefined, node.attrs.value as string); },
  },
}));

export const mathBlockSchema = $nodeSchema("math_block", () => ({
  group: "block",
  atom: true,
  isolating: true,
  attrs: { value: { default: "" } },
  parseDOM: [{ tag: "div[data-math-block]", getAttrs: dom => ({ value: (dom as HTMLElement).dataset.value ?? "" }) }],
  toDOM: node => ["div", { "data-math-block": "", "data-value": node.attrs.value }],
  parseMarkdown: {
    match: node => node.type === "math",
    runner: (state, node, type) => { state.addNode(type, { value: node.value as string }); },
  },
  toMarkdown: {
    match: node => node.type.name === "math_block",
    runner: (state, node) => { state.addNode("math", undefined, node.attrs.value as string); },
  },
}));

/** 行内公式：点击展开浮层源码框，所见即所改。 */
export const mathInlineView = $view(mathInlineSchema.node, () => createSourceView({
  inline: true,
  label: () => "行内公式",
  placeholder: "E = mc^2",
  read: node => node.attrs.value as string,
  write: (_node, value) => ({ value }),
  render: (host, node) => renderTex(host, node.attrs.value as string, false),
}));

export const mathBlockView = $view(mathBlockSchema.node, () => createSourceView({
  label: () => "公式",
  placeholder: "\\int_0^1 x^2 \\, dx",
  read: node => node.attrs.value as string,
  write: (_node, value) => ({ value }),
  render: (host, node) => renderTex(host, node.attrs.value as string, true),
}));

export const mathPlugins = [remarkMathPlugin, mathInlineSchema, mathBlockSchema, mathInlineView, mathBlockView].flat();
