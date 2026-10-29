import type { Root } from "mdast";
import { markRule } from "@milkdown/kit/prose";
import { $command, $inputRule, $markSchema, $remark } from "@milkdown/kit/utils";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { visit } from "unist-util-visit";

type InlineNode = { type: string; value?: string; children?: InlineNode[] };

/** 与站点渲染器保持一致的行内语法：`==高亮==` 与 `||剧透||`。 */
const INLINE_SYNTAX = [
  { type: "siteMark", open: "==", pattern: /==([^=\n]+)==/g },
  { type: "siteSpoiler", open: "||", pattern: /\|\|([^|\n]+)\|\|/g },
] as const;

/**
 * 把文本节点里的成对标记拆成自定义 mdast 节点，供 ProseMirror 解析为 mark。
 * @returns remark 转换器
 */
const remarkInlineSyntax = () => (tree: Root) => {
  visit(tree, "text", (node, index, parent) => {
    if (!parent || index === undefined) return;
    const value = node.value;
    if (!value.includes("==") && !value.includes("||")) return;

    const matches = INLINE_SYNTAX.flatMap(({ type, pattern }) =>
      [...value.matchAll(pattern)].map(match => ({ type, start: match.index, end: match.index + match[0].length, text: match[1] })),
    ).sort((a, b) => a.start - b.start);

    const parts: InlineNode[] = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.start < cursor) continue;
      if (match.start > cursor) parts.push({ type: "text", value: value.slice(cursor, match.start) });
      parts.push({ type: match.type, children: [{ type: "text", value: match.text }] });
      cursor = match.end;
    }
    if (!parts.length) return;
    if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
    (parent.children as InlineNode[]).splice(index, 1, ...parts);
    return index + parts.length;
  });
};

/**
 * 序列化阶段把自定义节点还原为成对符号；放在 toMarkdown 扩展里，避免被转义。
 * @returns remark-stringify 的 handlers 扩展
 */
const stringifyInlineSyntax = function (this: { data: () => Record<string, unknown[]> }) {
  const data = this.data();
  const extensions = (data.toMarkdownExtensions ??= []);
  extensions.push({
    handlers: Object.fromEntries(INLINE_SYNTAX.map(({ type, open }) => [
      type,
      (node: InlineNode, _parent: unknown, state: { containerPhrasing: (node: InlineNode, info: { before: string; after: string }) => string }) =>
        `${open}${state.containerPhrasing(node, { before: open.at(-1)!, after: open[0] })}${open}`,
    ])),
  });
};

export const remarkInlineSyntaxPlugin = $remark("siteInlineSyntax", () => function (this: unknown) {
  stringifyInlineSyntax.call(this as never);
  return remarkInlineSyntax();
});

export const siteMarkSchema = $markSchema("site_mark", () => ({
  parseDOM: [{ tag: "mark" }],
  toDOM: () => ["mark", { class: "site-mark" }, 0],
  parseMarkdown: {
    match: node => node.type === "siteMark",
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: mark => mark.type.name === "site_mark",
    runner: (state, mark) => { state.withMark(mark, "siteMark"); },
  },
}));

export const siteSpoilerSchema = $markSchema("site_spoiler", () => ({
  parseDOM: [{ tag: "span.spoiler" }],
  toDOM: () => ["span", { class: "site-spoiler" }, 0],
  parseMarkdown: {
    match: node => node.type === "siteSpoiler",
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: mark => mark.type.name === "site_spoiler",
    runner: (state, mark) => { state.withMark(mark, "siteSpoiler"); },
  },
}));

export const toggleSiteMarkCommand = $command("ToggleSiteMark", ctx => () => toggleMark(siteMarkSchema.type(ctx)));
export const toggleSiteSpoilerCommand = $command("ToggleSiteSpoiler", ctx => () => toggleMark(siteSpoilerSchema.type(ctx)));

/** 输入闭合符号时即时转换，与 `**粗体**` 的手感一致。 */
export const siteMarkInputRule = $inputRule(ctx => markRule(/(?:==)([^=\n]+)(?:==)$/, siteMarkSchema.type(ctx)));
export const siteSpoilerInputRule = $inputRule(ctx => markRule(/(?:\|\|)([^|\n]+)(?:\|\|)$/, siteSpoilerSchema.type(ctx)));

export const inlineMarks = [
  remarkInlineSyntaxPlugin,
  siteMarkSchema,
  siteSpoilerSchema,
  toggleSiteMarkCommand,
  toggleSiteSpoilerCommand,
  siteMarkInputRule,
  siteSpoilerInputRule,
].flat();
