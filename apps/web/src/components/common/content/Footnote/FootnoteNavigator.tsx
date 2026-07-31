"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  buildFootnoteRefDomId,
  FOOTNOTE_HIGHLIGHT_DURATION,
  highlightFootnoteElement,
  normalizeFootnoteId,
  scrollToFootnoteElement,
} from "./footnote-utils";

interface FootnoteNavigatorProps {
  children: ReactNode;
}

export function FootnoteNavigator({ children }: FootnoteNavigatorProps) {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightCleanupRef = useRef<Map<string, () => void>>(new Map());
  const lastReferenceMapRef = useRef<Map<string, string>>(new Map());

  const cleanupHighlight = useCallback((key: string) => {
    const cleanup = highlightCleanupRef.current.get(key);
    if (cleanup) {
      cleanup();
      highlightCleanupRef.current.delete(key);
    }
  }, []);

  const triggerHighlight = useCallback((element: HTMLElement, key: string) => {
    cleanupHighlight(key);
    highlightFootnoteElement(element, FOOTNOTE_HIGHLIGHT_DURATION);
    highlightCleanupRef.current.set(key, () => {
      delete element.dataset.footnoteState;
    });
  }, [cleanupHighlight]);

  const getContainer = useCallback(() => containerRef.current, []);

  const getFootnoteItem = useCallback((footnoteId: string) => {
    return getContainer()?.querySelector<HTMLElement>(`[data-footnote-item][data-footnote-id="${footnoteId}"]`) ?? null;
  }, [getContainer]);

  const getReferenceElement = useCallback((footnoteId: string, fallbackIndex = 1) => {
    const refId = lastReferenceMapRef.current.get(footnoteId) ?? buildFootnoteRefDomId(footnoteId, fallbackIndex);
    return getContainer()?.querySelector<HTMLElement>(`#${CSS.escape(refId)}`) ?? null;
  }, [getContainer]);

  const jumpToFootnote = useCallback((reference: HTMLElement) => {
    const footnoteId = normalizeFootnoteId(reference.dataset.footnoteId ?? "");
    if (!footnoteId)
      return;

    const item = getFootnoteItem(footnoteId);
    if (!item)
      return;

    lastReferenceMapRef.current.set(footnoteId, reference.id);
    scrollToFootnoteElement(item);
    triggerHighlight(item, `item:${footnoteId}`);
  }, [getFootnoteItem, triggerHighlight]);

  const returnToReference = useCallback((trigger: HTMLElement) => {
    const footnoteId = normalizeFootnoteId(trigger.dataset.footnoteId ?? "");
    if (!footnoteId)
      return;

    const reference = getReferenceElement(footnoteId);
    if (!reference)
      return;

    scrollToFootnoteElement(reference);
    triggerHighlight(reference, `ref:${reference.id}`);
  }, [getReferenceElement, triggerHighlight]);

  const handleReferenceKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, reference: HTMLElement) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      jumpToFootnote(reference);
    }
  }, [jumpToFootnote]);

  useEffect(() => {
    const highlightCleanupMap = highlightCleanupRef.current;

    return () => {
      for (const cleanup of highlightCleanupMap.values())
        cleanup();
      highlightCleanupMap.clear();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-footnote-container={containerId}
      className={cn(
        // 脚注区块整体加一条分割线
        "[&_section[data-footnotes-root]]:mt-12 [&_section[data-footnotes-root]]:border-t [&_section[data-footnotes-root]]:border-primary-200/70 [&_section[data-footnotes-root]]:pt-6",
        // 脚注列表样式
        "[&_ol.footnote-list]:list-[upper-roman] [&_ol.footnote-list]:list-outside [&_ol.footnote-list]:ml-5 md:[&_ol.footnote-list]:ml-6 [&_ol.footnote-list]:space-y-3 [&_ol.footnote-list]:text-sm md:[&_ol.footnote-list]:text-base",
        "[&_ol.footnote-list]:marker:text-accent-500 [&_ol.footnote-list]:marker:font-medium",
        // 脚注条目
        "[&_li[data-footnote-item]]:scroll-mt-28 [&_li[data-footnote-item]]:rounded-xl [&_li[data-footnote-item]]:px-3 [&_li[data-footnote-item]]:py-2.5 [&_li[data-footnote-item]]:transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] [&_li[data-footnote-item]]:duration-200 [&_li[data-footnote-item]]:leading-relaxed [&_li[data-footnote-item]]:text-primary-700",
        // 脚注条目 active 高亮
        "[&_li[data-footnote-item][data-footnote-state=active]]:bg-accent-100/60 dark:[&_li[data-footnote-item][data-footnote-state=active]]:bg-accent-100/20 [&_li[data-footnote-item][data-footnote-state=active]]:ring-1 [&_li[data-footnote-item][data-footnote-state=active]]:ring-accent-400/40 dark:[&_li[data-footnote-item][data-footnote-state=active]]:ring-accent-500/30",
        // 正文脚注引用徽标 (极简，类似维基百科)
        "[&_a[data-footnote-ref]]:relative [&_a[data-footnote-ref]]:mx-0.5 [&_a[data-footnote-ref]]:inline-flex [&_a[data-footnote-ref]]:items-center [&_a[data-footnote-ref]]:justify-center [&_a[data-footnote-ref]]:align-super [&_a[data-footnote-ref]]:text-xs [&_a[data-footnote-ref]]:font-medium [&_a[data-footnote-ref]]:text-accent-600 [&_a[data-footnote-ref]]:transition-colors [&_a[data-footnote-ref]]:duration-200 [&_a[data-footnote-ref]]:cursor-pointer",
        "[&_a[data-footnote-ref]::before]:content-['['] [&_a[data-footnote-ref]::after]:content-[']']",
        "[&_a[data-footnote-ref]:hover]:text-accent-700",
        // 正文引用 active 高亮
        "[&_a[data-footnote-ref][data-footnote-state=active]]:bg-accent-100/60 dark:[&_a[data-footnote-ref][data-footnote-state=active]]:bg-accent-100/20 [&_a[data-footnote-ref][data-footnote-state=active]]:rounded [&_a[data-footnote-ref][data-footnote-state=active]]:shadow-sm [&_a[data-footnote-ref][data-footnote-state=active]]:ring-1 [&_a[data-footnote-ref][data-footnote-state=active]]:ring-accent-400/40 dark:[&_a[data-footnote-ref][data-footnote-state=active]]:ring-accent-500/30 [&_a[data-footnote-ref][data-footnote-state=active]]:outline-none",
        // 被脚注标注的词（前一个词下划线提示）
        "[&_span[data-footnote-anchor]]:border-b [&_span[data-footnote-anchor]]:border-dashed [&_span[data-footnote-anchor]]:border-accent-400/70 [&_span[data-footnote-anchor]]:pb-px",
        // 回跳按钮
        "[&_a[data-footnote-backref]]:inline-flex [&_a[data-footnote-backref]]:items-center [&_a[data-footnote-backref]]:justify-center [&_a[data-footnote-backref]]:ml-2 [&_a[data-footnote-backref]]:size-6 [&_a[data-footnote-backref]]:rounded-full [&_a[data-footnote-backref]]:border [&_a[data-footnote-backref]]:border-primary-200/80 [&_a[data-footnote-backref]]:bg-surface-100/90 [&_a[data-footnote-backref]]:text-accent-500 [&_a[data-footnote-backref]]:text-sm [&_a[data-footnote-backref]]:transition-colors [&_a[data-footnote-backref]]:cursor-pointer [&_a[data-footnote-backref]]:shrink-0",
        "[&_a[data-footnote-backref]:hover]:bg-accent-50 [&_a[data-footnote-backref]:hover]:border-accent-300 [&_a[data-footnote-backref]:hover]:text-accent-700",
      )}
      onClick={(event) => {
        const target = event.target as HTMLElement;

        const backref = target.closest<HTMLElement>("[data-footnote-backref]");
        if (backref) {
          event.preventDefault();
          returnToReference(backref);
          return;
        }

        const reference = target.closest<HTMLElement>("[data-footnote-ref]");
        if (!reference)
          return;

        event.preventDefault();
        jumpToFootnote(reference);
      }}
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        const backref = target.closest<HTMLElement>("[data-footnote-backref]");
        if (backref && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          returnToReference(backref);
          return;
        }

        const reference = target.closest<HTMLElement>("[data-footnote-ref]");
        if (reference)
          handleReferenceKeyDown(event, reference);
      }}
    >
      {children}
    </div>
  );
}

export default FootnoteNavigator;
