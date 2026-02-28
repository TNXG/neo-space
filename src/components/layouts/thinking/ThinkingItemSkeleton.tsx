import { cn } from "@/lib/utils";

export function ThinkingItemSkeleton() {
  return (
    <article className="relative border-l-2 border-primary-200/50 pl-6 pb-2">
      {/* 时间线节点 */}
      <div className="absolute left-0 top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-primary-200/50 shadow-sm animate-pulse" />

      {/* 元信息空壳 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-4 bg-muted/30 rounded" />
        <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
      </div>

      {/* 内容空壳 */}
      <div className="space-y-3 mt-4">
        <div className="h-4 w-[95%] bg-muted/30 rounded animate-pulse" />
        <div className="h-4 w-[80%] bg-muted/30 rounded animate-pulse" />
        <div className="h-4 w-[60%] bg-muted/30 rounded animate-pulse" />
      </div>
    </article>
  );
}
