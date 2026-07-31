"use client";

import type { FC } from "react";
import type { ApiResponse, NavData, NavTopItem, Note, PaginatedResponse, Post, User } from "@/types/api";
import { NavigationMenu } from "@base-ui/react/navigation-menu";

import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";

import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/api-client";
import { getRelativeTime } from "@/lib/date";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { Link } from "@/locales/navigation";

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

function withLangParam(url: string, lang?: string) {
  if (!lang || lang === "zh") {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}lang=${encodeURIComponent(lang)}`;
}

function createSkeletonKeys(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

const RECENT_ACTIVITY_SKELETON_KEYS = createSkeletonKeys("recent-skeleton", 3);
const CATEGORY_SKELETON_KEYS = createSkeletonKeys("cat-skeleton", 4);
const POST_SKELETON_KEYS = createSkeletonKeys("posts-skeleton", 4);
const MOOD_SKELETON_KEYS = createSkeletonKeys("mood-skeleton", 3);
const NOTE_SKELETON_KEYS = createSkeletonKeys("notes-skeleton", 4);
const ALL_NOTES_SKELETON_KEYS = createSkeletonKeys("allnotes-skeleton", 4);

// ============================================================
//  Home Dropdown — 用户卡片 + 最新动态 + 快捷页面
// ============================================================

function navItemHref(item: NavTopItem) {
  return item.type === "post"
    ? `/posts/${item.category?.slug ?? "default"}/${item.slug}`
    : `/notes/${item.nid}`;
}

export const HomeDropdown: FC<DropdownPanelProps> = ({ user, isConnected }) => {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isLoading } = useSWR<ApiResponse<NavData>>(
    withLangParam(`${API_BASE_URL}/aggregate/nav`, locale),
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
                    <span className="truncate">{t("nav.online")}</span>
                  </>
                )
              : (
                  <span className="text-muted-foreground/80">{t("nav.offline")}</span>
                )}
          </div>
        </div>
      </NavigationMenu.Link>

      {/* Recent activity */}
      <div className="mt-2.5 border-t border-border/60 pt-2.5">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("nav.latestActivity")}
        </div>
        <div className="flex flex-col gap-1">
          {isLoading
            ? (
                RECENT_ACTIVITY_SKELETON_KEYS.map(skeletonKey => (
                  <div key={skeletonKey} className="rounded-xl px-2.5 py-2">
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
                          {item.type === "post" ? t("nav.postLabel") : t("nav.noteLabel")}
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
            {t("nav.friends")}
          </NavigationMenu.Link>
          <NavigationMenu.Link
            closeOnClick
            render={<Link href="/donate" />}
            className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent-500/10 hover:text-accent-600"
          >
            {t("nav.donate")}
          </NavigationMenu.Link>
          <NavigationMenu.Link
            closeOnClick
            render={<Link href="/about-me" />}
            className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent-500/10 hover:text-accent-600"
          >
            {t("nav.about")}
          </NavigationMenu.Link>
          <NavigationMenu.Link
            closeOnClick
            render={<Link href="/rss.xml" />}
            className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent-500/10 hover:text-accent-600"
          >
            {t("nav.rss")}
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
  const t = useTranslations();
  const locale = useLocale();
  // SWR deduplicates: same key as HomeDropdown → no extra request
  const { data: navData, isLoading: isNavLoading } = useSWR<ApiResponse<NavData>>(
    withLangParam(`${API_BASE_URL}/aggregate/nav`, locale),
    fetcher,
    { revalidateOnFocus: false },
  );

  const categories = navData?.data?.categories ?? [];
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const activeSlug = hoveredSlug ?? categories[0]?.slug ?? null;

  const { data: postsData, isLoading: isPostsLoading } = useSWR<PaginatedResponse<Post>>(
    activeSlug
      ? withLangParam(`${API_BASE_URL}/posts?page=1&size=4&category=${activeSlug}`, locale)
      : null,
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
            {t("nav.categories")}
          </div>
          <div className="flex flex-col gap-0.5">
            {isNavLoading
              ? (
                  CATEGORY_SKELETON_KEYS.map(skeletonKey => (
                    <div key={skeletonKey} className="flex items-center justify-between rounded-lg px-2.5 py-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                  ))
                )
              : categories.map(cat => (
                  <NavigationMenu.Link
                    key={cat._id}
                    closeOnClick
                    render={<Link href={`/categories/${cat.slug}`} />}
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
                        transition={{ type: "spring", bounce: 0, duration: 0.22 }}
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
            {t("nav.postsOfCategory", { name: categories.find(c => c.slug === activeSlug)?.name ?? t("nav.latest") })}
          </div>
          <div className="flex flex-col gap-1">
            {isPostsLoading
              ? (
                  POST_SKELETON_KEYS.map(skeletonKey => (
                    <div key={skeletonKey} className="rounded-xl px-2.5 py-2">
                      <Skeleton className="h-4 w-3/4 mb-1.5" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  ))
                )
              : recentPosts.map(post => (
                  <NavigationMenu.Link
                    key={post._id}
                    closeOnClick
                    render={<Link href={`/posts/${post.category?.slug ?? "default"}/${post.slug}`} />}
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
          <span>{t("nav.viewAllPosts")}</span>
          {totalCount > 0 && (
            <span>
              {totalCount}
              {t("nav.postsUnit")}
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
  const t = useTranslations();
  const locale = useLocale();
  const { data: notesData, isLoading } = useSWR<PaginatedResponse<Note>>(
    withLangParam(`${API_BASE_URL}/notes?page=1&size=8`, locale),
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
              {t("nav.moods")}
            </div>
            <div className="flex flex-col gap-0.5">
              {isLoading
                ? (
                    MOOD_SKELETON_KEYS.map(skeletonKey => (
                      <div key={skeletonKey} className="px-2.5 py-2">
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
                          transition={{ type: "spring", bounce: 0, duration: 0.22 }}
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
              {t("nav.recentNotes")}
            </div>
            <div className="flex flex-col gap-1">
              {isLoading
                ? (
                    NOTE_SKELETON_KEYS.map(skeletonKey => (
                      <div key={skeletonKey} className="rounded-xl px-2.5 py-2">
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
                  {t("nav.none")}
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
            <span>{t("nav.viewAllNotes")}</span>
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
        {t("nav.recentNotes")}
      </div>
      <div className="flex flex-col gap-1">
        {isLoading
          ? (
              ALL_NOTES_SKELETON_KEYS.map(skeletonKey => (
                <div key={skeletonKey} className="rounded-xl px-2.5 py-2">
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
          <span>{t("nav.viewAllNotes")}</span>
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
