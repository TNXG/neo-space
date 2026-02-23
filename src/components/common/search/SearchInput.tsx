"use client";

import type { RefObject } from "react";
import { Icon } from "@iconify/react/offline";
import { KbdShortcut } from "@/components/ui/kbd";

interface SearchInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function SearchInput({
  inputRef,
  query,
  isLoading,
  onQueryChange,
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
        placeholder="搜索文章和笔记..."
        className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
      />
      <KbdShortcut keys={["Esc"]} className="hidden sm:flex" />
    </div>
  );
}
