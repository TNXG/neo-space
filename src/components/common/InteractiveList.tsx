"use client";

import type { Note, Post } from "@/types/api";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import ArrowLeftLine from "~icons/mingcute/arrow-left-line";
import CalendarLine from "~icons/mingcute/calendar-line";
import CloudLine from "~icons/mingcute/cloud-line";

import Edit2Line from "~icons/mingcute/edit-2-line";
import EmojiLine from "~icons/mingcute/emoji-line";
import Folder2Line from "~icons/mingcute/folder-2-line";
import LoadingLine from "~icons/mingcute/loading-line";
import LocationLine from "~icons/mingcute/location-line";
import SparklesFill from "~icons/mingcute/sparkles-fill";
import TagLine from "~icons/mingcute/tag-line";
import { stripMarkdown, truncateText } from "@/components/common/markdown/utils";
import { SmartDate } from "@/components/common/smart-date";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { fetchNotes, fetchPosts } from "@/lib/api-client.client";
import { cn } from "@/lib/utils";

type Item = Post | Note;

interface InteractiveListProps<T extends Item> {
  items: T[];
  type: "post" | "note";
  emptyMessage?: string;
  pageSize?: number;
}

export function InteractiveList<T extends Item>({
  items: initialItems,
  type,
  emptyMessage = "选择一项查看详情",
  pageSize = 10,
}: InteractiveListProps<T>) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const mounted = useHasMounted();
  const isMobile = useIsMobile();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const getPageKey = useCallback((pageIndex: number) => {
    return `${type}-page-${pageIndex + 1}`;
  }, [type]);

  const getKey = useCallback((pageIndex: number, previousPageData: Awaited<ReturnType<typeof fetchPosts>> | null) => {
    if (!mounted)
      return null;
    if (previousPageData && !previousPageData.data.pagination.has_next_page)
      return null;

    return getPageKey(pageIndex);
  }, [mounted, getPageKey]);

  const fetcher = useCallback(async (key: string) => {
    const page = Number.parseInt(key.split("-").pop() || "1", 10);
    if (type === "post") {
      return fetchPosts(page, pageSize);
    }
    return fetchNotes(page, pageSize);
  }, [type, pageSize]);

  const {
    data: infiniteData,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const items = mounted && infiniteData && infiniteData.length > 0
    ? infiniteData.flatMap(page => page.data.items as T[])
    : initialItems;

  const hasMore = mounted
    ? (infiniteData?.[infiniteData.length - 1]?.data.pagination.has_next_page ?? initialItems.length >= pageSize)
    : initialItems.length >= pageSize;

  const prefetchNextPage = useCallback(() => {
    if (!mounted || isValidating || !hasMore)
      return;

    const nextKey = getPageKey(size);

    mutate(
      nextKey,
      fetcher(nextKey),
      {
        populateCache: true,
        revalidate: false,
      },
    ).catch(() => { });
  }, [mounted, isValidating, hasMore, size, getPageKey, mutate, fetcher]);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mounted || !loadMoreRef.current)
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isValidating) {
          setSize(size + 1);
        }
      },
      { rootMargin: "100px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [mounted, hasMore, isValidating, size, setSize]);

  const defaultSelectedId = !isMobile && initialItems.length > 0 ? initialItems[0]._id : null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const indicatorRef = useRef<HTMLDivElement>(null);

  const activeItem = !mounted || isMobile
    ? null
    : hoveredId
      ? items.find(item => item._id === hoveredId)
      : (selectedId && items.find(item => item._id === selectedId))
          ? items.find(item => item._id === selectedId)
          : items[0];

  useLayoutEffect(() => {
    if (!indicatorRef.current || !listRef.current)
      return;

    if (!activeItem) {
      indicatorRef.current.style.opacity = "0";
      return;
    }

    const itemEl = itemRefs.current.get(activeItem._id);
    if (!itemEl) {
      indicatorRef.current.style.opacity = "0";
      return;
    }

    const listRect = listRef.current.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();

    indicatorRef.current.style.setProperty("--indicator-top", `${itemRect.top - listRect.top}px`);
    indicatorRef.current.style.setProperty("--indicator-height", `${itemRect.height}px`);
    indicatorRef.current.style.opacity = "1";
  }, [activeItem]);

  const getItemUrl = useCallback((item: T): string => {
    if (type === "post") {
      const post = item as Post;
      const categorySlug = post.category?.slug || "default";
      return `/posts/${categorySlug}/${post.slug}`;
    }
    const note = item as Note;
    return `/notes/${note.nid}`;
  }, [type]);

  const handleMouseEnter = (id: string) => {
    if (!mounted || isMobile)
      return;
    setHoveredId(id);
    setSelectedId(id);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hour}:${minute}`;
  };

  const renderPreview = () => {
    if (!activeItem) {
      return (
        <div className="h-40 flex items-center justify-start text-muted-foreground opacity-50">
          <span className="flex items-center gap-2">
            <ArrowLeftLine className="w-4 h-4" />
            {emptyMessage}
          </span>
        </div>
      );
    }

    if (type === "post") {
      const post = activeItem as Post;
      return (
        <motion.div
          key={post._id}
          initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="flex flex-col items-start gap-1 text-sm font-mono text-muted-foreground">
            <div className="flex items-center gap-2" title="发布时间">
              <CalendarLine className="w-4 h-4" />
              <span>{formatDate(post.created)}</span>
            </div>
            {post.modified && (
              <div className="flex items-center gap-2 text-xs opacity-70" title="修改时间">
                <Edit2Line className="w-3.5 h-3.5" />
                <span>{formatDate(post.modified)}</span>
              </div>
            )}
          </div>

          <h2 className="text-3xl font-bold leading-tight text-foreground">
            {post.title}
          </h2>

          {post.category && (
            <div className="flex justify-start">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                <Folder2Line className="w-3.5 h-3.5" />
                {post.category.name}
              </span>
            </div>
          )}

          <div className="text-primary-600 text-sm leading-7">
            {post.aiSummary && !post.summary && (
              <div className="flex items-center gap-1.5 mb-2">
                <SparklesFill className="w-3.5 h-3.5 text-accent-500" />
                <span className="text-xs font-medium text-accent-600">AI 摘要</span>
              </div>
            )}
            <p className="text-left line-clamp-6">
              {post.summary || post.aiSummary
                ? truncateText(stripMarkdown(post.summary || post.aiSummary || ""), 300)
                : "暂无简介，请点击阅读详情..."}
            </p>
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap justify-start gap-2 pt-2">
              {post.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs text-accent-600 bg-accent-50 px-2 py-1 rounded-md border border-accent-100">
                  <TagLine className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      );
    }

    const note = activeItem as Note;
    return (
      <motion.div
        key={note._id}
        initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="space-y-6"
      >
        <div className="flex flex-col items-start gap-1 text-sm font-mono text-muted-foreground">
          <div className="flex items-center gap-2" title="发布时间">
            <CalendarLine className="w-4 h-4" />
            <span>{formatDate(note.created)}</span>
          </div>
          {note.modified && (
            <div className="flex items-center gap-2 text-xs opacity-70" title="修改时间">
              <Edit2Line className="w-3.5 h-3.5" />
              <span>{formatDate(note.modified)}</span>
            </div>
          )}
        </div>

        <h2 className="text-3xl font-bold leading-tight text-foreground">
          {note.title}
        </h2>

        <div className="flex flex-wrap justify-start gap-2">
          {note.mood && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
              <EmojiLine className="w-3.5 h-3.5" />
              {note.mood}
            </span>
          )}
          {note.weather && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              <CloudLine className="w-3.5 h-3.5" />
              {note.weather}
            </span>
          )}
          {note.location && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <LocationLine className="w-3.5 h-3.5" />
              {note.location}
            </span>
          )}
        </div>

        <div className="text-primary-600 text-sm leading-7">
          {note.aiSummary && (
            <div className="flex items-center gap-1.5 mb-2">
              <SparklesFill className="w-3.5 h-3.5 text-accent-500" />
              <span className="text-xs font-medium text-accent-600">AI 摘要</span>
            </div>
          )}
          <p className="text-left line-clamp-6">
            {note.aiSummary
              ? truncateText(stripMarkdown(note.aiSummary), 200)
              : truncateText(stripMarkdown(note.text), 200)}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] gap-6 md:gap-8 relative items-start">
        <aside className="hidden lg:block sticky top-24 h-fit pr-4 self-start">
          <AnimatePresence mode="wait">
            {renderPreview()}
          </AnimatePresence>
        </aside>

        <div className="flex flex-col">
          <div
            ref={listRef}
            className="space-y-0 lg:space-y-1 lg:border-l lg:border-border/50 relative"
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              ref={indicatorRef}
              className="hidden lg:block absolute left-0 w-[3px] bg-accent-500 rounded-r-full shadow-[0_0_10px_rgba(45,212,191,0.5)] pointer-events-none z-10 transition-all duration-200 ease-out"
              style={{
                top: "var(--indicator-top, 0)",
                height: "var(--indicator-height, 0)",
                opacity: 0,
              }}
            />

            {items.map((item, index) => {
              const isActive = mounted && activeItem?._id === item._id;
              const itemUrl = getItemUrl(item);

              const isLastFewItems = index >= items.length - 3;

              return (
                <Link
                  key={item._id}
                  ref={(el) => {
                    if (el)
                      itemRefs.current.set(item._id, el);
                  }}
                  href={itemUrl}
                  prefetch={false}
                  onMouseEnter={() => {
                    router.prefetch(itemUrl);
                    handleMouseEnter(item._id);
                    if (isLastFewItems)
                      prefetchNextPage();
                  }}
                  className="group relative block outline-none border-b border-dashed border-border/30 lg:border-0 last:border-0"
                >
                  <motion.div
                    className="absolute -inset-y-1 md:-inset-y-2 -inset-x-2 md:-inset-x-4 rounded-xl -z-10"
                    animate={{
                      backgroundColor: isActive && !isMobile ? "var(--bg-glass)" : "transparent",
                    }}
                    style={{
                      backgroundColor: isActive && !isMobile ? "rgba(var(--primary-100), 0.5)" : "transparent",
                    }}
                  />

                  <div className="flex items-baseline justify-between gap-3 md:gap-6 py-3 md:py-2 pl-3 md:pl-6 transition-transform duration-200 group-hover:translate-x-1">
                    <h3 className={cn(
                      "text-base md:text-lg min-w-0 flex-1 truncate transition-colors duration-200",
                      isActive && !isMobile
                        ? "text-accent-600 font-semibold"
                        : "text-foreground/80 font-medium",
                    )}
                    >
                      {item.title}
                    </h3>

                    <div className={cn(
                      "shrink-0 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm transition-colors min-w-[50px] md:min-w-[60px] justify-end",
                      isActive && !isMobile ? "text-accent-600/80" : "text-muted-foreground/50",
                    )}
                    >
                      <SmartDate
                        date={item.created}
                        modifiedDate={item.modified}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </Link>
              );
            })}

            <div
              className="relative flex flex-col items-center justify-center py-6 pl-3 md:pl-6 min-h-[80px]"
              onMouseEnter={prefetchNextPage}
            >
              <div
                ref={loadMoreRef}
                className="absolute bottom-0 left-0 w-full h-24 pointer-events-none opacity-0 z-[-1]"
              />

              <div className="relative w-full flex justify-center items-center">

                <div
                  className={cn(
                    "flex items-center gap-2 text-sm text-muted-foreground transition-all duration-300 absolute",
                    mounted && isValidating
                      ? "opacity-100 translate-y-0 visible"
                      : "opacity-0 translate-y-2 invisible",
                  )}
                >
                  {mounted && (
                    <LoadingLine className="w-4 h-4 animate-spin" />
                  )}
                  <span>加载中...</span>
                </div>
                <div
                  className={cn(
                    "text-sm text-muted-foreground/50 transition-all duration-300",
                    mounted && isValidating
                      ? "opacity-0 invisible delay-0"
                      : "opacity-100 visible delay-300",
                  )}
                >
                  {!hasMore
                    ? (
                        <span>
                          已加载全部
                          {items.length}
                          {" "}
                          条
                          {type === "post" ? "文章" : "日记"}
                        </span>
                      )
                    : (
                        <span>向下滚动加载更多</span>
                      )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
