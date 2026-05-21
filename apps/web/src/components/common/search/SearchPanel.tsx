"use client";

import type { SearchItem } from "./types";
import { AnimatePresence, motion } from "motion/react";
import { useLocale } from "next-intl";

import { useEffect, useMemo, useRef, useState } from "react";

import { useSearch } from "@/lib/api-client.client";
import { SearchFooter } from "./SearchFooter";
import { SearchInput } from "./SearchInput";
import { SearchResults } from "./SearchResults";
import { useSearchKeyboard } from "./useSearchKeyboard";
import { useSearchNavigation } from "./useSearchNavigation";

/**
 * 搜索面板属性
 */
interface SearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 全站搜索面板组件
 *
 * 自定义设计的搜索面板，支持文章和笔记的全文搜索
 * 功能：实时搜索、键盘导航、按相关度混编结果、关键字高亮
 */
export function SearchPanel({ open, onOpenChange }: SearchPanelProps) {
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [semantic, setSemantic] = useState(false);
  const prevQueryRef = useRef(debouncedQuery);

  const { data, isLoading } = useSearch(debouncedQuery, locale, undefined, 10, semantic);

  // 归一化各自分数后混排，避免因两类分数量纲不同而同类堆叠
  const allResults: SearchItem[] = useMemo(() => {
    if (!debouncedQuery.trim())
      return [];
    const posts = data?.data?.posts ?? [];
    const notes = data?.data?.notes ?? [];
    const maxPost = posts.reduce((m, p) => Math.max(m, p.score ?? 0), Number.EPSILON);
    const maxNote = notes.reduce((m, n) => Math.max(m, n.score ?? 0), Number.EPSILON);
    const items: (SearchItem & { ns: number })[] = [
      ...posts.map(p => ({ type: "post" as const, data: p, ns: (p.score ?? 0) / maxPost })),
      ...notes.map(n => ({ type: "note" as const, data: n, ns: (n.score ?? 0) / maxNote })),
    ];
    items.sort((a, b) => b.ns - a.ns);
    return items.map(({ type, data }) => ({ type, data }) as SearchItem);
  }, [data, debouncedQuery]);

  const hasQuery = debouncedQuery.trim().length > 0;

  // 导航逻辑
  const { navigateToResult } = useSearchNavigation({ onOpenChange });

  // 键盘交互
  const { handleKeyDown } = useSearchKeyboard({
    open,
    allResults,
    selectedIndex,
    setSelectedIndex,
    navigateToResult,
    onOpenChange,
  });

  // Debounce 搜索输入，并在查询变化时重置选中项
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query !== prevQueryRef.current) {
        prevQueryRef.current = query;
        setSelectedIndex(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 打开时自动聚焦
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // 关闭动画完成后清理状态
  const handleExitComplete = () => {
    setQuery("");
    setDebouncedQuery("");
    setSelectedIndex(0);
    setSemantic(false);
    prevQueryRef.current = "";
  };

  // 滚动选中项到可见区域
  useEffect(() => {
    if (!resultsRef.current)
      return;
    const selected = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 bg-black/30 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* 搜索面板 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="fixed z-101 left-1/2 top-[15vh] -translate-x-1/2 w-[min(600px,calc(100vw-2rem))]"
          >
            <div className="bg-card/80 backdrop-blur-2xl border border-border/40 rounded-2xl shadow-2xl overflow-hidden">
              <SearchInput
                inputRef={inputRef}
                query={query}
                isLoading={isLoading}
                semantic={semantic}
                onQueryChange={setQuery}
                onSemanticChange={setSemantic}
                onKeyDown={handleKeyDown}
              />

              <SearchResults
                resultsRef={resultsRef}
                hasQuery={hasQuery}
                query={debouncedQuery}
                isLoading={isLoading}
                results={allResults}
                selectedIndex={selectedIndex}
                onResultClick={navigateToResult}
                onResultHover={setSelectedIndex}
              />

              <SearchFooter />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
