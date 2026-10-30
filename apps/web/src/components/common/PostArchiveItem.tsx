import type { Post } from "@/types/api";
import { cn } from "@/lib/utils";
import { ArchiveMetadata } from "./ArchiveMetadata";

interface PostArchiveItemProps {
  post: Pick<Post, "title" | "created" | "category" | "tags">;
  isActive: boolean;
}

/**
 * 归档中的文章行：发布时间、标题与标签；不把更新时间误作发布时间。
 * @param props 文章及预览选中状态
 * @returns 放在原有导航链接中的文章信息
 */
export function PostArchiveItem({ post, isActive }: PostArchiveItemProps) {
  const created = new Date(post.created);
  const date = `${String(created.getMonth() + 1).padStart(2, "0")}/${String(created.getDate()).padStart(2, "0")}`;
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-xl px-2 py-1 lg:items-center lg:gap-3">
      <time dateTime={post.created} className={cn("shrink-0 pt-0.5 font-mono text-sm leading-[1.6] tabular-nums transition-colors duration-200 lg:pt-0", isActive ? "text-primary/80" : "text-muted-foreground")}>{date}</time>
      <div className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-0">
        <h3 className={cn("flex min-w-0 max-w-full items-start gap-2 text-base leading-[1.6] transition-colors duration-200 group-hover:text-primary lg:shrink-0 lg:pr-3", isActive ? "font-semibold text-primary" : "font-medium text-foreground")}>
          <span className="min-w-0 wrap-anywhere">{post.title}</span>
        </h3>
        {(post.category || post.tags.length > 0) && <ArchiveMetadata className="pl-6 lg:ml-auto lg:flex-1 lg:pl-0">{post.category?.name}{post.tags.length > 0 && <><span aria-hidden="true" className="mx-2">#</span>{post.tags.join(" · ")}</>}</ArchiveMetadata>}
      </div>
    </div>
  );
}
