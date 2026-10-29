import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { PluggableList } from "unified";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";

import { FootnoteNavigator } from "../content/Footnote/FootnoteNavigator";
import { KatexStyles } from "../content/KatexStyles";
import { getHighlighter } from "./highlighter";
import { createMarkdownComponents } from "./markdown-components";
import { collectCodeLanguages, KATEX_OPTIONS, markdownBaseRehypePlugins, markdownRemarkPlugins, MATH_CONTENT_REGEX, SHIKI_OPTIONS } from "./markdown-pipeline";
import { resolveMediaCards } from "./plugins/media-card/media-card.server";
import { rehypeFootnotes } from "./plugins/rehype-footnotes";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  hasScript?: boolean;
}

/**
 * 服务端渲染正文：预取影视卡片与按需加载代码语言后输出完整 HTML。
 * @param props 正文与额外类名
 * @returns 渲染后的正文
 */
export async function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const hasMath = MATH_CONTENT_REGEX.test(content);
  const [highlighter, mediaCards] = await Promise.all([
    getHighlighter(collectCodeLanguages(content)),
    resolveMediaCards(content),
  ]);
  const rehypePlugins: PluggableList = [
    ...markdownBaseRehypePlugins,
    [rehypeShikiFromHighlighter, highlighter, SHIKI_OPTIONS],
    ...(hasMath ? [[rehypeKatex, KATEX_OPTIONS] as PluggableList[number]] : []),
    rehypeFootnotes,
  ];

  return (
    <>
      {hasMath && <KatexStyles />}
      <FootnoteNavigator>
        <div className={`markdown-body ${className}`}>
          <ReactMarkdown remarkPlugins={markdownRemarkPlugins} rehypePlugins={rehypePlugins} components={createMarkdownComponents(mediaCards)}>
            {content}
          </ReactMarkdown>
        </div>
      </FootnoteNavigator>
    </>
  );
}
