"use client";

import { useEffect, useRef } from "react";

/** react-markdown / hast-util-to-jsx-runtime 注入的非 HTML 属性 */
const INTERNAL_PROPS = new Set(["children", "node", "className", "style"]);

interface ClientOnlyScriptProps {
  /** 从 hast 节点直接提取的脚本原始文本（优先使用，不受 rehype 插件污染） */
  scriptContent?: string;
  src?: string;
  type?: string;
  [key: string]: any;
}

/**
 * 在客户端动态插入 script 元素以确保执行。
 *
 * 注意：不能直接渲染 <script> 标签作为占位符，因为 React 19 会将渲染树中的
 * <script> 元素自动提升到文档 <head>，导致锚点偏移、内联脚本位置错误。
 * 改用 <span style="display:none"> 作为 DOM 锚点，规避该行为。
 */
export function ClientOnlyScript({ scriptContent, src, type, ...rest }: ClientOnlyScriptProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor)
      return;

    // 创建真正会被浏览器执行的 script 元素
    const script = document.createElement("script");

    // 复制 HTML 属性
    if (src)
      script.src = src;
    if (type)
      script.type = type;
    for (const key of Object.keys(rest)) {
      if (!INTERNAL_PROPS.has(key)) {
        try {
          script.setAttribute(key, String(rest[key]));
        } catch { /* 忽略不可设置的属性 */ }
      }
    }

    // 设置脚本文本内容
    if (scriptContent) {
      script.textContent = scriptContent;
    }

    // 将 script 插入到锚点之前
    anchor.parentNode?.insertBefore(script, anchor);

    return () => {
      script.parentNode?.removeChild(script);
    };
  // 脚本内容在页面生命周期内不变，仅挂载时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 用不可见的 span 作为 DOM 锚点，避免 React 19 的 <script> 提升行为
  return <span ref={anchorRef} style={{ display: "none" }} data-script-anchor suppressHydrationWarning />;
}
