"use client";

import type { Page } from "@/types/api";
import { motion } from "motion/react";
import { toast } from "sonner";
import useSWR from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_PAGES_KEY, deleteDashboardPage, getDashboardPages } from "@/lib/dashboard-content";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { NewDraftList } from "./NewDraftList";
import { useContentDraftStore } from "./use-content-editor";

/**
 * 独立页面列表：按排序字段展示，删除采用乐观更新并在失败时回滚。
 * @returns 页面管理页
 */
export function PageList() {
  const pages = useSWR(DASHBOARD_PAGES_KEY, getDashboardPages);
  const drafts = useContentDraftStore(state => state.drafts);

  const remove = async (page: Page) => {
    try {
      await pages.mutate(async (current) => {
        await deleteDashboardPage(page._id);
        return current?.filter(item => item._id !== page._id);
      }, { optimisticData: current => current?.filter(item => item._id !== page._id) ?? [], rollbackOnError: true, revalidate: false });
      useContentDraftStore.getState().set(`page:${page._id}`, undefined);
      toast.success("已删除");
    } catch (error) {
      toast.error(error instanceof Error ? `删除失败：${error.message}` : "删除失败");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-5 lg:px-6 lg:py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">页面</h2>
          <p className="text-sm text-muted-foreground tabular-nums">{pages.data ? `共 ${pages.data.length} 个` : "正在读取…"}</p>
        </div>
        <Button asChild size="sm" className="rounded-lg">
          <Link href="/dashboard/pages/new"><Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />新建页面</Link>
        </Button>
      </header>

      <NewDraftList kind="page" />

      {pages.error && (
        <Alert variant="destructive">
          <AlertTitle>页面列表读取失败</AlertTitle>
          <AlertDescription>
            <p>{pages.error instanceof Error ? pages.error.message : "请稍后重试"}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { void pages.mutate(); }}>重试</Button>
          </AlertDescription>
        </Alert>
      )}

      {!pages.data && !pages.error && (
        <ul aria-busy="true" className="flex flex-col gap-1">
          {[0, 1, 2].map(row => <li key={row} className="flex flex-col gap-2 px-3 py-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/5" /></li>)}
        </ul>
      )}

      {pages.data?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Icon icon="mingcute:file-line" aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>还没有独立页面</EmptyTitle>
            <EmptyDescription>适合放「关于」「友链说明」这类固定内容。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {pages.data && pages.data.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {pages.data.map((page, index) => (
            <motion.li
              key={page._id}
              initial={{ opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.24, delay: Math.min(index, 10) * 0.03, ease: [0.23, 1, 0.32, 1] }}
              className="group/row relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-(--motion-duration-fast) hover:bg-secondary/60"
            >
              <Link href={`/dashboard/pages/${page._id}`} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{page.title || "无标题"}</span>
                  {`page:${page._id}` in drafts && <span aria-label="有未保存修改" title="有未保存修改" className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </span>
                <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">/{page.slug}</span>
                  {page.subtitle && <span className="truncate">· {page.subtitle}</span>}
                </span>
              </Link>
              <div className="relative z-10 opacity-100 transition-opacity duration-(--motion-duration-fast) lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-focus-within/row:opacity-100">
                <ConfirmDeleteButton label={`「${page.title}」`} onConfirm={() => remove(page)} />
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
