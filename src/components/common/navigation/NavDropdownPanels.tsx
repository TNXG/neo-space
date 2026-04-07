"use client";

import type { FC } from "react";
import type { ApiResponse, NavData, NavTopItem, Note, PaginatedResponse, Post, User } from "@/types/api";
import { NavigationMenu } from "@base-ui/react/navigation-menu";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/api-client";
import { getRelativeTime } from "@/lib/date";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

export interface DropdownPanelProps {
  user?: User;
  isConnected?: boolean;
  onlineCount?: number;
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`API Error: ${response.status}`);
  return response.json();
}

// ============================================================
//  Home Dropdown — 用户卡片 + 最新动态 + 快捷页面
// ============================================================

function navItemHref(item: NavTopItem) {
  return item.type === "post" ? `/posts/${item.slug}` : `/notes/${item.nid}`;
}

export const HomeDropdown: FC<DropdownPanelProps> = ({ user, isConnected }) => {
  const { data, isLoading } = useSWR<ApiResponse<NavData>>(
    `${API_BASE_URL}/aggregate/nav`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const recentItems = data?.data?.recent ?? [];
  return (
    <div className="w-70 p-3">
      {/* Owner card */}
      <NavigationMenu.Link
        closeOnClick
        className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-accent-500/5"
        render={<Link href="/" />}
      >
        {user?.avatar
          ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="shrink-0 rounded-full ring-1 ring-border/50 h-9 w-9 object-cover bg-secondary/50"
              />
            )
          : (
              <div className="relative shrink-0 flex items-center justify-center h-9 w-9 rounded-full font-bold text-muted-foreground bg-secondary ring-1 ring-border/50">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug">{user?.name}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {isConnected
              ? (
                  <>
                    <span className="inline-block size-1.5 shrink-0 rounded-full bg-green-500" />
                    <span className="truncate">在线</span>
                  </>
                )
              : (
                  <span className="text-muted-foreground/80">离线</span>
                )}
          </div>
        </div>
      </NavigationMenu.Link>

      {/* Recent activity */}
      <div className="mt-2.5 border-t border-border/60 pt-2.5">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          最新动态
        </div>
        <div className="flex flex-col gap-1">
          {isLoading
            ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={`recent-skeleton-${i}`} className="rounded-xl px-2.5 py-2">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))
              )
            : recentItems.length > 0
              ? (
                  recentItems.map(item => (
                    <NavigationMenu.Link
                      key={item.id}
                      closeOnClick
                      render={<Link href={navItemHref(item)} />}
                      className="rounded-xl bg-secondary/40 px-2.5 py-2 transition-colors hover:bg-accent-500/10 hover:text-accent-600"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0 truncate text-[13px] leading-snug">{item.title}</div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {item.type === "post" ? "文章" : "手记"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {getRelativeTime(item.created)}
                      </div>
                    </NavigationMenu.Link>
                  ))
                )
              : null}
        </div>
      </div>

      {/* Pages pills */}
      <div className="mt-2.5 border-t border-border/60 pt-2.5">
        <div className="flex flex-wrap gap-1.5">
          <NavigationMenu.Link
            closeOnClick
            render={<Link href="/friends" />}
            className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent-500/10 hover:text-accent-600"
          >
            友链
          </NavigationMenu.Link>
          <NavigationMenu.Link
            closeOnClick
            render={<Link href="/about-me" />}
            className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent-500/10 hover:text-accent-600"
          >
            关于我
          </NavigationMenu.Link>
          <NavigationMenu.Link
            closeOnClick
            render={<Link href="/rss.xml" />}
            className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent-500/10 hover:text-accent-600"
          >
            RSS 订阅
          </NavigationMenu.Link>
        </div>
      </div>
    </div>
  );
};

// ============================================================
//  Posts Dropdown — 分类（含文章数）+ 悬停预览文章
// ============================================================
export const PostsDropdown: FC<DropdownPanelProps> = () => {
  // SWR deduplicates: same key as HomeDropdown → no extra request
  const { data: navData, isLoading: isNavLoading } = useSWR<ApiResponse<NavData>>(
    `${API_BASE_URL}/aggregate/nav`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const categories = navData?.data?.categories ?? [];
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const activeSlug = hoveredSlug ?? categories[0]?.slug ?? null;

  const { data: postsData, isLoading: isPostsLoading } = useSWR<PaginatedResponse<Post>>(
    activeSlug ? `${API_BASE_URL}/posts?page=1&size=4&category=${activeSlug}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const recentPosts = postsData?.data?.items ?? [];
  const totalCount = categories.reduce((sum, c) => sum + (c.count ?? 0), 0);

  return (
    <div className="w-95 p-3">
      <div className="grid grid-cols-[130px_1fr] gap-3">
        {/* Left: categories */}
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            分类
          </div>
          <div className="flex flex-col gap-0.5">
            {isNavLoading
              ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`cat-skeleton-${i}`} className="flex items-center justify-between rounded-lg px-2.5 py-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                  ))
                )
              : categories.map(cat => (
                  <NavigationMenu.Link
                    key={cat._id}
                    closeOnClick
                    render={<Link href={`/posts?category=${cat.slug}`} />}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] transition-colors relative z-0",
                      activeSlug === cat.slug
                        ? "text-accent-600"
                        : "hover:text-accent-600",
                    )}
                    onMouseEnter={() => setHoveredSlug(cat.slug)}
                  >
                    {activeSlug === cat.slug && (
                      <motion.div
                        layoutId="active-category-bg"
                        className="absolute inset-0 bg-accent-500/10 rounded-lg -z-10"
                        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                      />
                    )}
                    <span className="truncate">{cat.name}</span>
                    {cat.count !== undefined && (
                      <span className="ml-1 shrink-0 text-[11px] text-muted-foreground">
                        {cat.count}
                      </span>
                    )}
                  </NavigationMenu.Link>
                ))}
          </div>
        </div>

        {/* Right: recent posts */}
        <div className="min-w-0">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {categories.find(c => c.slug === activeSlug)?.name ?? "最新"}
            的文章
          </div>
          <div className="flex flex-col gap-1">
            {isPostsLoading
              ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`posts-skeleton-${i}`} className="rounded-xl px-2.5 py-2">
                      <Skeleton className="h-4 w-3/4 mb-1.5" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  ))
                )
              : recentPosts.map(post => (
                  <NavigationMenu.Link
                    key={post._id}
                    closeOnClick
                    render={<Link href={`/posts/${post.slug}`} />}
                    className="rounded-xl bg-secondary/40 px-2.5 py-2 transition-colors hover:bg-accent-500/10 hover:text-accent-600"
                  >
                    <div className="truncate text-[13px] leading-snug">{post.title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {getRelativeTime(post.created)}
                    </div>
                  </NavigationMenu.Link>
                ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 border-t border-border/60 pt-2">
        <NavigationMenu.Link
          closeOnClick
          render={<Link href="/posts" />}
          className="flex items-center justify-between text-[11px] text-muted-foreground transition-colors hover:text-accent-600"
        >
          <span>查看全部文章</span>
          {totalCount > 0 && (
            <span>
              {totalCount}
              {" "}
              篇
            </span>
          )}
        </NavigationMenu.Link>
      </div>
    </div>
  );
};

// ============================================================
//  Notes Dropdown — 心情标签（左）+ 最近手记（右）
// ============================================================
export const NotesDropdown: FC<DropdownPanelProps> = () => {
  const { data: notesData, isLoading } = useSWR<PaginatedResponse<Note>>(
    `${API_BASE_URL}/notes?page=1&size=8`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const allNotes = notesData?.data?.items ?? [];
  const moods = [...new Set(allNotes.filter(n => n.mood).map(n => n.mood as string))];
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Two-column layout when enough mood data is available
  if (isLoading || moods.length >= 2) {
    const activeMood = selectedMood ?? moods[0];
    const filteredNotes = isLoading ? [] : allNotes.filter(n => n.mood === activeMood).slice(0, 4);

    return (
      <div className="w-90 p-3">
        <div className="grid grid-cols-[100px_1fr] gap-3">
          {/* Left: mood tags */}
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              心情
            </div>
            <div className="flex flex-col gap-0.5">
              {isLoading
                ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={`mood-skeleton-${i}`} className="px-2.5 py-2">
                        <Skeleton className="h-4 w-12" />
                      </div>
                    ))
                  )
                : moods.map(mood => (
                    <button
                      key={mood}
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-left transition-colors cursor-pointer w-full relative z-0",
                        activeMood === mood
                          ? "text-accent-600"
                          : "hover:text-accent-600",
                      )}
                      onMouseEnter={() => setSelectedMood(mood)}
                    >
                      {activeMood === mood && (
                        <motion.div
                          layoutId="active-mood-bg"
                          className="absolute inset-0 bg-accent-500/10 rounded-lg -z-10"
                          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                        />
                      )}
                      <span>{mood}</span>
                    </button>
                  ))}
            </div>
          </div>

          {/* Right: filtered notes */}
          <div className="min-w-0">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              最近手记
            </div>
            <div className="flex flex-col gap-1">
              {isLoading
                ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={`notes-skeleton-${i}`} className="rounded-xl px-2.5 py-2">
                        <Skeleton className="h-4 w-3/4 mb-1.5" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    ))
                  )
                : filteredNotes.map(note => (
                    <NavigationMenu.Link
                      key={note._id}
                      closeOnClick
                      render={<Link href={`/notes/${note.nid}`} />}
                      className="rounded-xl bg-secondary/40 px-2.5 py-2 transition-colors hover:bg-accent-500/10 hover:text-accent-600"
                    >
                      <div className="min-w-0 truncate text-[13px] leading-snug">{note.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{getRelativeTime(note.created)}</span>
                        {note.weather && (
                          <span className="flex items-center gap-0.5">
                            <Icon icon="mingcute:cloud-line" className="text-[10px]" />
                            {note.weather}
                          </span>
                        )}
                      </div>
                    </NavigationMenu.Link>
                  ))}
              {!isLoading && filteredNotes.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  暂无
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 border-t border-border/60 pt-2">
          <NavigationMenu.Link
            closeOnClick
            render={<Link href="/notes" />}
            className="flex items-center justify-between text-[11px] text-muted-foreground transition-colors hover:text-accent-600"
          >
            <span>查看全部手记</span>
            <Icon icon="mingcute:arrow-right-line" className="text-xs" />
          </NavigationMenu.Link>
        </div>
      </div>
    );
  }

  // Single-column fallback
  return (
    <div className="w-70 p-3">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        最近手记
      </div>
      <div className="flex flex-col gap-1">
        {isLoading
          ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`allnotes-skeleton-${i}`} className="rounded-xl px-2.5 py-2">
                  <Skeleton className="h-4 w-3/4 mb-1.5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))
            )
          : allNotes.slice(0, 4).map(note => (
              <NavigationMenu.Link
                key={note._id}
                closeOnClick
                render={<Link href={`/notes/${note.nid}`} />}
                className="rounded-xl bg-secondary/40 px-2.5 py-2 transition-colors hover:bg-accent-500/10 hover:text-accent-600"
              >
                <div className="flex items-center gap-1.5">
                  {note.mood && <span className="text-sm">{note.mood}</span>}
                  <span className="min-w-0 truncate text-[13px] leading-snug">{note.title}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{getRelativeTime(note.created)}</span>
                  {note.weather && (
                    <span className="flex items-center gap-0.5">
                      <Icon icon="mingcute:cloud-line" className="text-[10px]" />
                      {note.weather}
                    </span>
                  )}
                </div>
              </NavigationMenu.Link>
            ))}
      </div>

      <div className="mt-2 border-t border-border/60 pt-2">
        <NavigationMenu.Link
          closeOnClick
          render={<Link href="/notes" />}
          className="flex items-center justify-between text-[11px] text-muted-foreground transition-colors hover:text-accent-600"
        >
          <span>查看全部手记</span>
          <Icon icon="mingcute:arrow-right-line" className="text-xs" />
        </NavigationMenu.Link>
      </div>
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const dropdownPanelMap: Record<string, FC<DropdownPanelProps>> = {
  home: HomeDropdown,
  posts: PostsDropdown,
  notes: NotesDropdown,
};
