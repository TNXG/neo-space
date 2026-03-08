"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { loadMoreThinkings } from "@/lib/actions/thinking";
import { ThinkingItemSkeleton } from "./ThinkingItemSkeleton";

interface ThinkingListProps {
  initialNodes: ReactNode[];
  initialHasNextPage: boolean;
  isEmpty: boolean;
}

export function ThinkingList({ initialNodes, initialHasNextPage, isEmpty }: ThinkingListProps) {
  const [nodes, setNodes] = useState<ReactNode[]>(initialNodes);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [isPending, startTransition] = useTransition();

  // 使用 IntersectionObserver 监听滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isPending) {
          startTransition(async () => {
            const nextPage = page + 1;
            const result = await loadMoreThinkings(nextPage);
            setNodes(prev => [...prev, ...result.nodes]);
            setHasNextPage(result.hasNextPage);
            setPage(nextPage);
          });
        }
      },
      { rootMargin: "100px" },
    );

    const loadMoreTrigger = document.getElementById("load-more-trigger");
    if (loadMoreTrigger) {
      observer.observe(loadMoreTrigger);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isPending, page]);

  if (isEmpty) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>暂无碎碎念</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {nodes}

      {/* 骨架屏和加载触发器 */}
      {hasNextPage && (
        <div id="load-more-trigger" className="pt-4">
          <ThinkingItemSkeleton />
        </div>
      )}

      {/* 到底了 */}
      {!hasNextPage && nodes.length > 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground/60">
          - 已经到底啦 -
        </div>
      )}
    </div>
  );
}
