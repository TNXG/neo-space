"use client";

import type { Link, LinkStateType } from "@/types/api";
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { LinkState } from "@/types/api";
import { FriendEditor, STATE_LABELS } from "./FriendEditor";
import { FriendRow } from "./FriendRow";
import { useFriendManager } from "./use-friend-manager";

const TABS: { state: LinkStateType; count: "pass" | "audit" | "outdate" | "rejected" | "banned"; highlight?: boolean }[] = [
  { state: LinkState.NORMAL, count: "pass" },
  { state: LinkState.PENDING, count: "audit", highlight: true },
  { state: LinkState.OUTDATED, count: "outdate" },
  { state: LinkState.REJECTED, count: "rejected" },
  { state: LinkState.BANNED, count: "banned" },
];

const EMPTY_HINT: Record<LinkStateType, string> = {
  [LinkState.NORMAL]: "添加第一位朋友，或等待访客提交申请。",
  [LinkState.PENDING]: "没有待处理的申请。",
  [LinkState.OUTDATED]: "没有被标记为过时的站点。",
  [LinkState.REJECTED]: "没有被拒绝的申请。",
  [LinkState.BANNED]: "没有被屏蔽的站点。",
};

const parseState = (raw: string | null): LinkStateType => {
  const value = Number(raw);
  return TABS.some(tab => tab.state === value) ? value as LinkStateType : LinkState.NORMAL;
};

/**
 * 友链管理：按状态分标签，标签计数与待审核高亮；行内处理审核、检测与删除。
 * @returns 友链管理页
 */
export function FriendManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = parseState(searchParams.get("state"));
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Link | null | undefined>(undefined);
  const [checkingAll, setCheckingAll] = useState(false);
  const { links, counts, save, changeState, remove, recheck, recheckAll } = useFriendManager(state, page);
  const pagination = links.data?.pagination;

  const selectTab = (next: LinkStateType) => {
    setPage(1);
    router.replace(next === LinkState.NORMAL ? "?" : `?state=${next}`, { scroll: false });
  };

  const runRecheckAll = async () => {
    setCheckingAll(true);
    await recheckAll().catch(() => undefined);
    setCheckingAll(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
            友链
            {counts.data && <span className="text-sm font-normal text-muted-foreground tabular-nums">{counts.data.pass}</span>}
          </h2>
          <p className="text-xs text-muted-foreground">站点可用性与订阅源会定期在后台检测，也可以手动触发。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={checkingAll} onClick={runRecheckAll}>
            <Icon icon="mingcute:radar-2-line" data-icon="inline-start" className={cn(checkingAll && "animate-pulse")} aria-hidden="true" />
            {checkingAll ? "检测中…" : "检测全部"}
          </Button>
          <Button type="button" size="sm" className="rounded-lg" onClick={() => setEditing(null)}>
            <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />添加友链
          </Button>
        </div>
      </header>

      <div role="tablist" aria-label="友链状态" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border/60 px-1 no-scrollbar">
        {TABS.map((tab) => {
          const active = tab.state === state;
          const count = counts.data?.[tab.count] ?? 0;
          return (
            <button
              key={tab.state}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(tab.state)}
              className={cn(
                "relative flex h-10 shrink-0 cursor-pointer items-center gap-2 px-3 text-sm outline-none transition-colors duration-(--motion-duration-fast) focus-visible:ring-2 focus-visible:ring-ring",
                active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {STATE_LABELS[tab.state]}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6875rem] leading-none tabular-nums", tab.highlight && count > 0 ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{count}</span>
              {active && <motion.span layoutId="friend-tab-indicator" transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {links.error && (
        <Alert variant="destructive">
          <AlertTitle>友链读取失败</AlertTitle>
          <AlertDescription>
            <p>{links.error instanceof Error ? links.error.message : "请稍后重试"}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { void links.mutate(); }}>重试</Button>
          </AlertDescription>
        </Alert>
      )}

      {!links.data && !links.error && (
        <ul aria-busy="true" className="flex flex-col gap-1">
          {[0, 1, 2, 3].map(row => (
            <li key={row} className="flex items-start gap-3 px-3 py-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
            </li>
          ))}
        </ul>
      )}

      {!links.error && links.data?.items.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Icon icon="mingcute:link-2-line" aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>{STATE_LABELS[state]}为空</EmptyTitle>
            <EmptyDescription>{EMPTY_HINT[state]}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!links.error && links.data && links.data.items.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {links.data.items.map((link, index) => (
            <motion.li
              key={link._id}
              layout="position"
              initial={{ opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, delay: Math.min(index, 10) * 0.03, ease: [0.23, 1, 0.32, 1] }}
            >
              <FriendRow link={link} onEdit={setEditing} onState={changeState} onRecheck={recheck} onDelete={remove} />
            </motion.li>
          ))}
        </ul>
      )}

      {pagination && pagination.total_page > 1 && (
        <nav aria-label="分页" className="flex items-center justify-center gap-3 text-sm">
          <Button type="button" variant="ghost" size="sm" disabled={!pagination.has_prev_page} onClick={() => setPage(current => current - 1)}>上一页</Button>
          <span className="text-muted-foreground tabular-nums">{pagination.current_page} / {pagination.total_page}</span>
          <Button type="button" variant="ghost" size="sm" disabled={!pagination.has_next_page} onClick={() => setPage(current => current + 1)}>下一页</Button>
        </nav>
      )}

      <FriendEditor target={editing} onClose={() => setEditing(undefined)} onSave={save} />
    </div>
  );
}
