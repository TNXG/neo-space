"use client";

import type { Post } from "@/types/api";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardPostsKey, DASHBOARD_CATEGORIES_KEY, deleteDashboardPost, getDashboardCategories, getDashboardPosts } from "@/lib/dashboard-content";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { Link } from "@/locales/navigation";
import { PostArchive } from "./PostArchive";
import { NewDraftList } from "./NewDraftList";
import { useContentDraftStore } from "./use-content-editor";

const ALL = "all";

/**
 * 文章归档：发布时间倒序，支持关键词与分类筛选、分页和乐观删除。
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
            文章归档
            {pagination && <span className="text-sm font-normal text-muted-foreground tabular-nums">{pagination.total}</span>}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon icon="mingcute:calendar-line" className="size-3.5" aria-hidden="true" />
            按发布时间 · 最新在前
          </p>
        </div>
        <Button asChild size="sm" className="rounded-lg">
          <Link href="/dashboard/posts/new"><Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />写文章</Link>
        </Button>
      </header>

      <NewDraftList kind="post" />

      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/30 p-3 lg:flex-row">
        <InputGroup className="lg:flex-1">
          <InputGroupInput value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="搜索标题或正文" aria-label="搜索文章" />
          <InputGroupAddon><Icon icon="mingcute:search-line" aria-hidden="true" /></InputGroupAddon>
        </InputGroup>
        <Select value={categoryId} onValueChange={(value) => { setCategoryId(value); setPage(1); }}>
          <SelectTrigger aria-label="按分类筛选" className="w-full lg:w-44"><SelectValue /></SelectTrigger>
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
        <div aria-busy="true" aria-label="正在读取文章" className="flex flex-col gap-5">
          <Skeleton className="h-16 w-44" />
          <ul className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map(row => <li key={row} className="flex items-center gap-4 px-2 py-3"><Skeleton className="h-3 w-11" /><Skeleton className="h-4 w-2/3" /></li>)}
          </ul>
        </div>
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
        <div aria-busy={posts.isValidating} className={cn("transition-opacity duration-200", posts.isValidating && "opacity-60")}>
          <PostArchive items={posts.data.items} hasUnsaved={_id => `post:${_id}` in drafts} onDelete={remove} />
        </div>
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
