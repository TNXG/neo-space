"use client";

import type { Post } from "@/types/api";
import { motion } from "motion/react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardPostsKey, DASHBOARD_CATEGORIES_KEY, deleteDashboardPost, getDashboardCategories, getDashboardPosts } from "@/lib/dashboard-content";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { NewDraftList } from "./NewDraftList";
import { useContentDraftStore } from "./use-content-editor";

const ALL = "all";
const dateFormat = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" });

/**
 * 单篇文章行：整行可点进入编辑，删除按钮独立；有未保存草稿时显示圆点。
 * @param props 文章、草稿标记与删除回调
 * @returns 列表行
 */
function PostRow({ post, unsaved, onDelete, index }: { post: Post; unsaved: boolean; onDelete: () => Promise<unknown>; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.24, delay: Math.min(index, 10) * 0.03, ease: [0.23, 1, 0.32, 1] }}
      className="group/row relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-(--motion-duration-fast) hover:bg-secondary/60"
    >
      <Link href={`/dashboard/posts/${post._id}`} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{post.title || "无标题"}</span>
          {!post.isPublished && <Badge variant="secondary" className="shrink-0">草稿</Badge>}
          {unsaved && <span aria-label="有未保存修改" title="有未保存修改" className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {post.category && <span className="shrink-0">{post.category.name}</span>}
          <span className="tabular-nums">{dateFormat.format(new Date(post.modified ?? post.created))}</span>
          {post.tags.length > 0 && <span className="truncate">· {post.tags.join(" · ")}</span>}
        </span>
      </Link>
      <div className="relative z-10 opacity-100 transition-opacity duration-(--motion-duration-fast) lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-focus-within/row:opacity-100">
        <ConfirmDeleteButton label={`「${post.title}」`} onConfirm={onDelete} />
      </div>
    </motion.li>
  );
}

/**
 * 文章列表：关键词与分类筛选、分页、乐观删除。
 * @returns 文章管理页
 */
export function PostList() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState(ALL);
  const deferredKeyword = useDeferredValue(keyword.trim());
  const query = { page, keyword: deferredKeyword || undefined, categoryId: categoryId === ALL ? undefined : categoryId };
  const posts = useSWR(dashboardPostsKey(query), () => getDashboardPosts(query), { keepPreviousData: true });
  const categories = useSWR(DASHBOARD_CATEGORIES_KEY, getDashboardCategories);
  const drafts = useContentDraftStore(state => state.drafts);
  const { mutate } = useSWRConfig();
  const pagination = posts.data?.pagination;

  const remove = async (post: Post) => {
    try {
      await posts.mutate(async (current) => {
        await deleteDashboardPost(post._id);
        return current && { ...current, items: current.items.filter(item => item._id !== post._id) };
      }, {
        optimisticData: current => current ? { ...current, items: current.items.filter(item => item._id !== post._id) } : { items: [], pagination: posts.data!.pagination },
        rollbackOnError: true,
        revalidate: false,
      });
      useContentDraftStore.getState().set(`post:${post._id}`, undefined);
      await mutate(key => Array.isArray(key) && key[0] === "dashboard-posts");
      toast.success("已删除");
    } catch (error) {
      toast.error(error instanceof Error ? `删除失败：${error.message}` : "删除失败");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-5 lg:px-6 lg:py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">文章</h2>
          <p className="text-sm text-muted-foreground tabular-nums">{pagination ? `共 ${pagination.total} 篇` : "正在读取…"}</p>
        </div>
        <Button asChild size="sm" className="rounded-lg">
          <Link href="/dashboard/posts/new"><Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />写文章</Link>
        </Button>
      </header>

      <NewDraftList kind="post" />

      <div className="flex flex-col gap-2 sm:flex-row">
        <InputGroup className="sm:flex-1">
          <InputGroupAddon><Icon icon="mingcute:search-line" aria-hidden="true" /></InputGroupAddon>
          <InputGroupInput value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="搜索标题或正文" aria-label="搜索文章" />
        </InputGroup>
        <Select value={categoryId} onValueChange={(value) => { setCategoryId(value); setPage(1); }}>
          <SelectTrigger aria-label="按分类筛选" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent position="popper" align="end">
            <SelectGroup>
              <SelectItem value={ALL}>全部分类</SelectItem>
              {categories.data?.map(category => <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {posts.error && (
        <Alert variant="destructive">
          <AlertTitle>文章列表读取失败</AlertTitle>
          <AlertDescription>
            <p>{posts.error instanceof Error ? posts.error.message : "请稍后重试"}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { void posts.mutate(); }}>重试</Button>
          </AlertDescription>
        </Alert>
      )}

      {!posts.data && !posts.error && (
        <ul aria-busy="true" className="flex flex-col gap-1">
          {[0, 1, 2, 3, 4].map(row => <li key={row} className="flex flex-col gap-2 px-3 py-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/4" /></li>)}
        </ul>
      )}

      {posts.data && posts.data.items.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Icon icon="mingcute:document-2-line" aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>{deferredKeyword || categoryId !== ALL ? "没有匹配的文章" : "还没有文章"}</EmptyTitle>
            <EmptyDescription>{deferredKeyword || categoryId !== ALL ? "换个关键词或分类试试。" : "写下第一篇吧。"}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {posts.data && posts.data.items.length > 0 && (
        <ul className={posts.isValidating ? "flex flex-col gap-0.5 opacity-70 transition-opacity" : "flex flex-col gap-0.5 transition-opacity"}>
          {posts.data.items.map((post, index) => <PostRow key={post._id} post={post} index={index} unsaved={`post:${post._id}` in drafts} onDelete={() => remove(post)} />)}
        </ul>
      )}

      {pagination && pagination.total_page > 1 && (
        <nav aria-label="分页" className="flex items-center justify-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="rounded-lg" disabled={!pagination.has_prev_page} onClick={() => setPage(value => value - 1)}>
            <Icon icon="mingcute:left-line" data-icon="inline-start" aria-hidden="true" />上一页
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{pagination.current_page} / {pagination.total_page}</span>
          <Button type="button" variant="ghost" size="sm" className="rounded-lg" disabled={!pagination.has_next_page} onClick={() => setPage(value => value + 1)}>
            下一页<Icon icon="mingcute:right-line" data-icon="inline-end" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}
