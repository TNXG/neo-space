"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkdownRendererClient } from "@/components/common/markdown/MarkdownRenderer.client";
import type { ContentMeta } from "@/types/api";

interface BlockPreview {
  key: number;
  markdown: string;
}

/**
 * 将节点预览作为当前 React 树的 Portal 渲染，保留国际化、主题等上下文。
 * @param meta 正文图片元数据
 * @returns Milkdown 渲染回调与需要挂载的 Portal
 */
export const useBlockPreviews = (meta?: ContentMeta | null) => {
  const [blocks, setBlocks] = useState(() => new Map<HTMLElement, BlockPreview>());
  const [keys] = useState(() => new WeakMap<HTMLElement, number>());
  const sequence = useRef(0);
  const renderBlock = useCallback((host: HTMLElement, markdown: string) => {
    let key = keys.get(host);
    if (key === undefined) {
      key = sequence.current++;
      keys.set(host, key);
    }
    const block = { key, markdown };
    setBlocks(previous => new Map(previous).set(host, block));
    return () => {
      setBlocks((previous) => {
        // 旧预览的清理不能移除同一宿主上已经更新的内容。
        if (previous.get(host) !== block) return previous;
        const next = new Map(previous);
        next.delete(host);
        return next;
      });
    };
  }, [keys]);

  const previews = Array.from(blocks, ([host, block]) => createPortal(
    <MarkdownRendererClient content={block.markdown} meta={meta} />,
    host,
    block.key,
  ));
  return { renderBlock, previews };
};
