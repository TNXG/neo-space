"use client";

import type { RefObject } from "react";
import { KbdShortcut } from "@/components/ui/kbd";
import { Icon } from "@/lib/inline-icon";

interface SearchInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  isLoading: boolean;
  semantic: boolean;
  onQueryChange: (query: string) => void;
  onSemanticChange: (semantic: boolean) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function SearchInput({
  inputRef,
  query,
  isLoading,
  semantic,
  onQueryChange,
  onSemanticChange,
  onKeyDown,
}: SearchInputProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
      <Icon
        icon={isLoading ? "mingcute:loading-line" : "mingcute:search-2-line"}
        className={`text-xl text-muted-foreground shrink-0 ${isLoading ? "animate-spin" : ""}`}
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={semantic ? "语义搜索文章和笔记..." : "搜索文章和笔记..."}
        className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
      />
      <button
        type="button"
        onClick={() => onSemanticChange(!semantic)}
        title={semantic ? "关闭语义搜索" : "开启语义搜索"}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer text-sm font-medium ${
          semantic
            ? "bg-primary/10 text-primary"
            : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
        }`}
      >
        <Icon icon="mingcute:sparkles-2-line" className="text-base" />
        <span>语义搜索</span>
      </button>
      <KbdShortcut keys={["Esc"]} className="hidden sm:flex" />
    </div>
  );
}
