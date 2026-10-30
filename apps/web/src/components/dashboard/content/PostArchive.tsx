"use client";

import type { Post } from "@/types/api";
import { motion } from "motion/react";
import { ArchiveMetadata } from "@/components/common/ArchiveMetadata";
import { ArchiveTitle } from "@/components/common/ArchiveTitle";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

interface PostArchiveProps {
  items: Post[];
  hasUnsaved: (_id: string) => boolean;
  onDelete: (post: Post) => Promise<void>;
}

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" });

/**
 * 日期在左、标题与分类居中、标签在右的紧凑管理行；编辑与删除互不干扰。
 * @param props 文章、未保存状态和删除回调
 * @returns 文章归档行
 */
function PostArchiveRow({ post, unsaved, onDelete, index }: { post: Post; unsaved: boolean; onDelete: () => Promise<void>; index: number }) {
  const created = new Date(post.created);
  return (
    <motion.li
      initial={{ opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.24, delay: Math.min(index, 10) * 0.03, ease: [0.23, 1, 0.32, 1] }}
      className="group/row relative flex min-w-0 items-center gap-2 rounded-xl px-2 py-1 transition-colors duration-200 lg:gap-3"
    >
      <time dateTime={post.created} title={`发布时间：${dateFormat.format(created)}`} className="w-12 shrink-0 font-mono text-sm text-muted-foreground tabular-nums">{dayFormat.format(created)}</time>
      <Link href={`/dashboard/posts/${post._id}`} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded-lg py-1 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring lg:flex-row lg:items-center lg:gap-0">
        <span className="flex min-w-0 max-w-full items-center gap-2 lg:shrink-0 lg:pr-4">
          <Icon icon="mingcute:document-2-line" aria-hidden="true" className="hidden size-4 shrink-0 text-primary/70 lg:block" />
          <span className="min-w-0 text-base leading-relaxed font-medium wrap-anywhere transition-colors group-hover/row:text-primary">{post.title || "无标题"}</span>
          {!post.isPublished && <Badge variant="secondary" className="shrink-0">未发布</Badge>}
          {unsaved && <span aria-label="有未保存修改" title="有未保存修改" className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </span>
        <ArchiveMetadata className="lg:ml-auto lg:flex-1">
          {post.category?.name}
          {post.tags.length > 0 && <><span aria-hidden="true" className="mx-2">#</span>{post.tags.join(" · ")}</>}
        </ArchiveMetadata>
      </Link>
      <div className="relative z-10 shrink-0 lg:opacity-0 lg:transition-opacity lg:group-hover/row:opacity-100 lg:group-focus-within/row:opacity-100">
        <ConfirmDeleteButton label={`「${post.title}」`} onConfirm={onDelete} />
      </div>
    </motion.li>
  );
}

/**
 * 按发布时间年份分组，不改变服务端顺序；计数仅代表当前分页。
 * @param props 当前页文章、未保存状态查询与删除回调
 * @returns 带描边年份标题的文章归档
 */
export function PostArchive({ items, hasUnsaved, onDelete }: PostArchiveProps) {
  const groups = new Map<string, { post: Post; index: number }[]>();
  for (const [index, post] of items.entries()) {
    const year = String(new Date(post.created).getFullYear());
    const group = groups.get(year);
    if (group) group.push({ post, index });
    else groups.set(year, [{ post, index }]);
  }

  return (
    <div className="flex flex-col gap-10">
      {Array.from(groups, ([year, posts]) => (
        <section key={year} aria-label={`${year} 年文章`} className="group/archive relative min-w-0">
          <ArchiveTitle year={year} className="sticky top-0">
            <span>本页 {posts.length} 篇</span>
          </ArchiveTitle>
          <ul className="relative flex flex-col gap-0.5">
            {posts.map(({ post, index }) => <PostArchiveRow key={post._id} post={post} index={index} unsaved={hasUnsaved(post._id)} onDelete={() => onDelete(post)} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
