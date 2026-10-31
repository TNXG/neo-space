"use client";

import type { Link } from "@/types/api";
import type { FeaturedLink } from "@/utils/friends";
import { useLocale, useTranslations } from "next-intl";
import { formatSmartDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { FriendAvatar, FriendPing, FriendTechStack, hostnameOf } from "./FriendMeta";

const ENTRY = "group/entry relative flex h-full cursor-pointer flex-col outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring";

/** 站点署名：头像 + 站名（加重）+ 域名，位于文章标题上方。 */
function Byline({ link }: { link: Link }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FriendAvatar link={link} className="size-6 rounded-md text-[0.625rem]" />
      <span className="truncate text-sm font-semibold text-foreground">{link.name}</span>
      <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">{hostnameOf(link.url)}</span>
    </span>
  );
}

/**
 * 有订阅文章的朋友：以最新文章为主体，站名作为加重的署名；
 * 底部附发布时间、文章总数、Ping 与技术栈。
 * @param props 友链
 * @returns 文章条目
 */
export function FriendPostEntry({ link }: { link: FeaturedLink }) {
  const t = useTranslations("friends.story");
  const locale = useLocale() as Parameters<typeof formatSmartDate>[1];
  const { latest, total } = link.feed;

  return (
    <a href={latest.url || link.url} target="_blank" rel="noopener noreferrer" className={cn(ENTRY, "gap-2 py-4")}>
      <Byline link={link} />
      <h3 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight text-foreground transition-colors duration-(--motion-duration-fast) group-hover/entry:text-accent-600">{latest.title}</h3>
      {latest.summary && <p className="line-clamp-2 text-sm leading-relaxed text-foreground/65">{latest.summary}</p>}
      <div className="relative z-10 mt-auto flex flex-nowrap items-center gap-x-3 overflow-hidden pt-2 text-[0.6875rem] text-muted-foreground">
        {latest.published && <time dateTime={latest.published} className="shrink-0 tabular-nums">{formatSmartDate(latest.published, locale)}</time>}
        {total > 0 && <span className="shrink-0 tabular-nums">{t("total", { count: total })}</span>}
        <FriendPing health={link.health} className="shrink-0" />
        <FriendTechStack techstack={link.techstack} className="ml-auto min-w-0" />
      </div>
    </a>
  );
}

/**
 * 无订阅或抓取失败的朋友：降级为站点条目，站名为标题。
 * @param props 友链
 * @returns 站点条目
 */
export function FriendQuietEntry({ link }: { link: Link }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={cn(ENTRY, "gap-1.5 py-3")}>
      <span className="flex min-w-0 items-center gap-2">
        <FriendAvatar link={link} className="size-6 rounded-md text-[0.625rem]" />
        <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">{hostnameOf(link.url)}</span>
      </span>
      <h3 className="truncate text-base font-semibold text-foreground transition-colors duration-(--motion-duration-fast) group-hover/entry:text-accent-600">{link.name}</h3>
      {link.description && <p className="line-clamp-1 text-xs text-foreground/60">{link.description}</p>}
      <div className="relative z-10 mt-auto flex flex-nowrap items-center gap-x-3 overflow-hidden pt-1.5">
        <FriendPing health={link.health} className="shrink-0" />
        <FriendTechStack techstack={link.techstack} className="ml-auto min-w-0" />
      </div>
    </a>
  );
}
