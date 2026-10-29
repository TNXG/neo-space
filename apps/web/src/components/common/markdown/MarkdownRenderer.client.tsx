"use client";

import type { PluggableList } from "unified";
import type { Highlighter } from "./highlighter";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { useDeferredValue, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";

import { FootnoteNavigator } from "../content/Footnote/FootnoteNavigator";
import { KatexStyles } from "../content/KatexStyles";
import { getHighlighter } from "./highlighter";
import { createMarkdownComponents } from "./markdown-components";
import { collectCodeLanguages, KATEX_OPTIONS, markdownBaseRehypePlugins, markdownRemarkPlugins, MATH_CONTENT_REGEX, SHIKI_OPTIONS } from "./markdown-pipeline";
import { rehypeFootnotes } from "./plugins/rehype-footnotes";

const components = createMarkdownComponents();

/**
 * 按需加载正文所用语言；语言集合不变时复用同一高亮器，避免逐字输入触发重复加载。
 * @param content Markdown 原文
 * @returns 就绪的高亮器，加载中为 undefined
 */
function useHighlighter(content: string) {
  const key = collectCodeLanguages(content).sort().join(",");
  const [state, setState] = useState<{ key: string; highlighter: Highlighter }>();

  useEffect(() => {
    let active = true;
    void getHighlighter(key ? key.split(",") : []).then((highlighter) => {
      if (active) setState({ key, highlighter });
    });
    return () => { active = false; };
  }, [key]);

  return state?.highlighter;
}

/**
 * 后台实时预览：与公共站 MarkdownRenderer 共享插件链与组件映射，仅数据获取改为客户端。
 * @param props 正文与额外类名
 * @returns 渲染结果
 */
export function MarkdownRendererClient({ content, className = "" }: { content: string; className?: string }) {
  const deferred = useDeferredValue(content);
  const highlighter = useHighlighter(deferred);
  const hasMath = MATH_CONTENT_REGEX.test(deferred);
  const rehypePlugins: PluggableList = [
    ...markdownBaseRehypePlugins,
    ...(highlighter ? [[rehypeShikiFromHighlighter, highlighter, SHIKI_OPTIONS] as PluggableList[number]] : []),
    ...(hasMath ? [[rehypeKatex, KATEX_OPTIONS] as PluggableList[number]] : []),
    rehypeFootnotes,
  ];

  return (
    <>
      {hasMath && <KatexStyles />}
      <FootnoteNavigator>
        <div className={`markdown-body ${className}`}>
          <ReactMarkdown remarkPlugins={markdownRemarkPlugins} rehypePlugins={rehypePlugins} components={components}>
            {deferred}
          </ReactMarkdown>
        </div>
      </FootnoteNavigator>
    </>
  );
}
