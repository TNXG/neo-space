"use client";

import type { Link, LinkStateType } from "@/types/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FriendAvatar, FriendPing, FriendTechStack, hostnameOf } from "@/components/layouts/friends/FriendMeta";
import { getRelativeTime } from "@/lib/date";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { LinkState } from "@/types/api";
import { ConfirmDeleteButton } from "../content/ConfirmDeleteButton";

interface FriendRowProps {
  link: Link;
  onEdit: (link: Link) => void;
  onState: (link: Link, next: LinkStateType, message: string) => Promise<void>;
  onRecheck: (link: Link) => Promise<void>;
  onDelete: (link: Link) => Promise<void>;
}

/** 订阅源状态：成功给出文章数与最新标题，失败给出原因，未配置时安静提示。 */
function FeedStatus({ link }: { link: Link }) {
  if (!link.rssurl) return <span className="text-muted-foreground/60">未配置订阅源</span>;
  if (!link.feed) return <span className="text-muted-foreground">订阅源待检测</span>;
  if (link.feed.error_message) {
    return (
      <span className="flex min-w-0 items-center gap-1 text-destructive">
        <Icon icon="mingcute:rss-line" className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">订阅失败 · {link.feed.error_message}</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
      <Icon icon="mingcute:rss-line" className="size-3.5 shrink-0 text-accent-600" aria-hidden="true" />
      <span className="shrink-0 tabular-nums">{link.feed.total} 篇</span>
      {link.feed.latest && (
        <a href={link.feed.latest.url || link.url} target="_blank" rel="noopener noreferrer" className="relative z-10 cursor-pointer truncate rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          · {link.feed.latest.title}
        </a>
      )}
    </span>
  );
}

/**
 * 友链行：主体点击编辑；审核态直接给出通过 / 拒绝，其余操作收进菜单。
 * @param props 友链与操作回调
 * @returns 列表行
 */
export function FriendRow({ link, onEdit, onState, onRecheck, onDelete }: FriendRowProps) {
  const [checking, setChecking] = useState(false);
  const pending = link.state === LinkState.PENDING;

  const recheck = async () => {
    setChecking(true);
    try {
      await onRecheck(link);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="group/row relative flex items-start gap-3 rounded-xl px-3 py-3 transition-colors duration-(--motion-duration-fast) hover:bg-secondary/60">
      <FriendAvatar link={link} className="mt-0.5 size-9 rounded-lg text-sm" />
      <button type="button" onClick={() => onEdit(link)} aria-label={`编辑「${link.name}」`} className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{link.name}</span>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="pointer-events-auto relative z-10 cursor-pointer truncate rounded-sm font-mono text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{hostnameOf(link.url)}</a>
        </span>
        {link.description && <span className="line-clamp-1 text-xs text-foreground/60">{link.description}</span>}
        <span className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <FriendPing health={link.health} className="relative z-10" />
          <span className="flex min-w-0 max-w-full flex-1"><FeedStatus link={link} /></span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <FriendTechStack techstack={link.techstack} limit={6} />
          <span className="text-[0.6875rem] text-muted-foreground/70">{getRelativeTime(link.created)}加入</span>
          {link.email && <span className="truncate text-[0.6875rem] text-muted-foreground/70">{link.email}</span>}
        </span>
      </div>

      <div className={cn("relative z-10 flex shrink-0 items-center gap-1 transition-opacity duration-(--motion-duration-fast)", !pending && "lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-focus-within/row:opacity-100")}>
        {pending && (
          <>
            <Button type="button" size="sm" className="h-8 rounded-lg" onClick={() => onState(link, LinkState.NORMAL, `已通过「${link.name}」`)}>
              <Icon icon="mingcute:check-line" data-icon="inline-start" aria-hidden="true" />通过
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg text-muted-foreground" onClick={() => onState(link, LinkState.REJECTED, `已拒绝「${link.name}」`)}>拒绝</Button>
          </>
        )}
        <Button type="button" size="icon-sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={checking} aria-label={`重新检测「${link.name}」`} title="重新检测站点与订阅源" onClick={recheck}>
          <Icon icon="mingcute:refresh-2-line" className={cn(checking && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost" className="rounded-lg text-muted-foreground" aria-label={`「${link.name}」更多操作`}>
              <Icon icon="mingcute:more-2-line" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onEdit(link)}><Icon icon="mingcute:edit-2-line" aria-hidden="true" />编辑</DropdownMenuItem>
              {link.state !== LinkState.NORMAL && <DropdownMenuItem onSelect={() => onState(link, LinkState.NORMAL, `已恢复「${link.name}」`)}><Icon icon="mingcute:check-circle-line" aria-hidden="true" />设为通过</DropdownMenuItem>}
              {link.state !== LinkState.OUTDATED && <DropdownMenuItem onSelect={() => onState(link, LinkState.OUTDATED, `已标记「${link.name}」为过时`)}><Icon icon="mingcute:time-line" aria-hidden="true" />标记过时</DropdownMenuItem>}
              {link.state !== LinkState.BANNED && <DropdownMenuItem onSelect={() => onState(link, LinkState.BANNED, `已屏蔽「${link.name}」`)}><Icon icon="mingcute:forbid-circle-line" aria-hidden="true" />屏蔽</DropdownMenuItem>}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><a href={link.url} target="_blank" rel="noopener noreferrer"><Icon icon="mingcute:external-link-line" aria-hidden="true" />访问站点</a></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDeleteButton label={`「${link.name}」`} onConfirm={() => onDelete(link)} />
      </div>
    </div>
  );
}
