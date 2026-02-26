"use client";

import FileUnknownLine from "~icons/mingcute/file-unknown-line";
import Search2Line from "~icons/mingcute/search-2-line";

interface SearchEmptyStateProps {
  hasQuery: boolean;
  query: string;
}

export function SearchEmptyState({ hasQuery, query }: SearchEmptyStateProps) {
  if (!hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search2Line className="text-3xl mb-2 opacity-30" />
        <p className="text-sm">输入关键词开始搜索</p>
        <p className="text-xs mt-1 opacity-60">支持搜索文章标题、内容、标签</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileUnknownLine className="text-3xl mb-2 opacity-30" />
      <p className="text-sm">
        未找到与
        {" "}
        <span className="text-foreground font-medium">
          &quot;
          {query}
          &quot;
        </span>
        {" "}
        相关的内容
      </p>
    </div>
  );
}
