"use client";

import type { RefObject } from "react";

import type { SearchItem } from "./types";
import { SearchEmptyState } from "./SearchEmptyState";
import { SearchResultItem } from "./SearchResultItem";

interface SearchResultsProps {
  resultsRef: RefObject<HTMLDivElement | null>;
  hasQuery: boolean;
  query: string;
  isLoading: boolean;
  results: SearchItem[];
  selectedIndex: number;
  onResultClick: (item: SearchItem) => void;
  onResultHover: (index: number) => void;
}

export function SearchResults({
  resultsRef,
  hasQuery,
  query,
  isLoading,
  results,
  selectedIndex,
  onResultClick,
  onResultHover,
}: SearchResultsProps) {
  const hasResults = results.length > 0;

  return (
    <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto overscroll-contain">
      {/* 空查询或无结果 */}
      {(!hasQuery || (!isLoading && !hasResults)) && (
        <SearchEmptyState hasQuery={hasQuery} query={query} />
      )}

      {/* 搜索结果列表 */}
      {hasResults && (
        <div className="px-2 py-2 space-y-0.5">
          {results.map((item, i) => (
            <SearchResultItem
              key={`${item.type}-${item.data.id}`}
              item={item}
              index={i}
              isSelected={selectedIndex === i}
              onClick={() => onResultClick(item)}
              onMouseEnter={() => onResultHover(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
