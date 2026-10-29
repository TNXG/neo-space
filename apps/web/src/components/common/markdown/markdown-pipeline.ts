import type { PluggableList } from "unified";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleMarkers from "remark-flexible-markers";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { remarkContainer } from "./plugins/container";
import { remarkMathDelimiters } from "./plugins/math";
import { remarkMediaCard } from "./plugins/media-card";
import { remarkMermaid } from "./plugins/mermaid";
import { rehypeInlineSyntax } from "./plugins/rehype-inline-syntax";
import { remarkSpoiler } from "./plugins/spoiler";

export const MATH_CONTENT_REGEX = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([^)]+?\\\)/;
export const CODE_BLOCK_REGEX = /(?:^|\n)(?:```|~~~)\s*([\w-]+)/g;

/** 正文 remark 插件链；服务端与后台预览共用同一顺序。 */
export const markdownRemarkPlugins: PluggableList = [remarkSpoiler, remarkFlexibleMarkers, remarkGfm, remarkBreaks, remarkMathDelimiters, remarkMath, remarkMermaid, remarkContainer, remarkMediaCard];

/** 代码高亮之前的 rehype 插件。 */
export const markdownBaseRehypePlugins: PluggableList = [rehypeRaw, rehypeInlineSyntax, rehypeSlug];

/** KaTeX 渲染参数，含物理包常用宏。 */
export const KATEX_OPTIONS = {
  trust: true,
  strict: false,
  output: "html",
  macros: {
    "\\bra": "\\langle #1|",
    "\\ket": "|#1\\rangle",
    "\\braket": "\\langle #1 \\rangle",
    "\\dd": "\\mathrm{d}",
    "\\dv": "\\frac{\\mathrm{d} #1}{\\mathrm{d} #2}",
    "\\pdv": "\\frac{\\partial #1}{\\partial #2}",
    "\\abs": "\\left| #1 \\right|",
    "\\norm": "\\left\\| #1 \\right\\|",
    "\\eval": "\\left. #1 \\right|_{#2}",
    "\\order": "\\mathcal{O}\\left( #1 \\right)",
    "\\comm": "\\left[ #1, #2 \\right]",
    "\\acomm": "\\left\\{ #1, #2 \\right\\}",
    "\\vb": "\\mathbf{#1}",
    "\\vdot": "\\cdot",
    "\\cross": "\\times",
    "\\grad": "\\nabla",
    "\\div": "\\nabla \\cdot",
    "\\curl": "\\nabla \\times",
    "\\laplacian": "\\nabla^2",
  },
} as const;

/**
 * 收集正文中出现的代码语言，供 Shiki 按需加载。
 * @param content Markdown 原文
 * @returns 小写语言名列表
 */
export const collectCodeLanguages = (content: string) => {
  const languages = new Set<string>();
  for (const match of content.matchAll(CODE_BLOCK_REGEX)) {
    if (match[1]) languages.add(match[1].toLowerCase());
  }
  return [...languages];
};

export const SHIKI_OPTIONS = {
  themes: { light: "light-plus", dark: "dark-plus" },
  addLanguageClass: true,
} as const;
