"use client";

import type { ReactNode } from "react";
import type { Category, Note, Post } from "@/types/api";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { MarkdownPreviewClient } from "@/components/common/markdown/MarkdownPreview.client";
import { stripMarkdown, truncateText } from "@/components/common/markdown/utils";
import { SmartDate } from "@/components/common/smart-date";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { fetchNotes, fetchPosts } from "@/lib/api-client.client";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/locales/navigation";

// ─── Types ───────────────────────────────────────────────────────────

export interface InfiniteScrollConfig<T> {
  pageSize: number;
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[]; hasNextPage: boolean }>;
  keyPrefix: string;
}

export interface ListItemMeta {
  isActive: boolean;
  index: number;
}

interface InteractiveListProps<T> {
  items: T[];
  getItemKey: (item: T) => string;
  getItemUrl: (item: T) => string;
  renderPreview: (item: T) => ReactNode;
  renderListItem: (item: T, meta: ListItemMeta) => ReactNode;
  emptyMessage?: string;
  previewPosition?: "left" | "right";
  infiniteScroll?: InfiniteScrollConfig<T>;
}

// ─── Generic InteractiveList ─────────────────────────────────────────

export function InteractiveList<T>({
  items: initialItems,
  getItemKey,
  getItemUrl,
  renderPreview,
  renderListItem,
  emptyMessage,
  previewPosition = "left",
  infiniteScroll,
}: InteractiveListProps<T>) {
  const t = useTranslations();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const mounted = useHasMounted();
  const isMobile = useIsMobile();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  // ── SWR Infinite Scroll ──
  const hasInfiniteScroll = !!infiniteScroll;

  const getKey = useCallback((pageIndex: number, previousPageData: { items: T[]; hasNextPage: boolean } | null) => {
    if (!mounted || !infiniteScroll)
      return null;
    if (previousPageData && !previousPageData.hasNextPage)
      return null;
    return `${infiniteScroll.keyPrefix}-page-${pageIndex + 1}`;
  }, [mounted, infiniteScroll]);

  const swrFetcher = useCallback(async (key: string) => {
    if (!infiniteScroll)
      return { items: [] as T[], hasNextPage: false };
    const page = Number.parseInt(key.split("-").pop() || "1", 10);
    return infiniteScroll.fetcher(page, infiniteScroll.pageSize);
  }, [infiniteScroll]);

  const {
    data: infiniteData,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite(getKey, swrFetcher, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const items: T[] = mounted && hasInfiniteScroll && infiniteData && infiniteData.length > 0
    ? infiniteData.flatMap(page => page.items)
    : initialItems;

  const pageSize = infiniteScroll?.pageSize ?? 10;
  const hasMore = !hasInfiniteScroll
    ? false
    : mounted
      ? (infiniteData?.at(-1)?.hasNextPage ?? initialItems.length >= pageSize)
      : initialItems.length >= pageSize;

  const prefetchNextPage = useCallback(() => {
    if (!mounted || !infiniteScroll || isValidating || !hasMore)
      return;
    const nextKey = `${infiniteScroll.keyPrefix}-page-${size + 1}`;
    mutate(nextKey, swrFetcher(nextKey), { populateCache: true, revalidate: false }).catch(() => {});
  }, [mounted, infiniteScroll, isValidating, hasMore, size, mutate, swrFetcher]);

  // ── Active Item Management ──
  const defaultSelectedId = !isMobile && initialItems.length > 0 ? getItemKey(initialItems[0]) : null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId);

  const activeItem = !mounted || isMobile
    ? null
    : hoveredId
      ? items.find(item => getItemKey(item) === hoveredId)
      : (selectedId && items.some(item => getItemKey(item) === selectedId))
          ? items.find(item => getItemKey(item) === selectedId)
          : items[0];

  // ── Indicator Bar (Left Preview Only) ──
  const listRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const indicatorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (previewPosition !== "left" || !indicatorRef.current || !listRef.current)
      return;
    if (!activeItem) {
      indicatorRef.current.style.opacity = "0";
      return;
    }
    const itemEl = itemRef.current.get(getItemKey(activeItem));
    if (!itemEl) {
      indicatorRef.current.style.opacity = "0";
      return;
    }
    const listRect = listRef.current.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    indicatorRef.current.style.setProperty("--indicator-top", `${itemRect.top - listRect.top}px`);
    indicatorRef.current.style.setProperty("--indicator-height", `${itemRect.height}px`);
    indicatorRef.current.style.opacity = "1";
  }, [activeItem, previewPosition, getItemKey]);

  // ── Infinite Scroll Observer ──
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mounted || !loadMoreRef.current || !hasInfiniteScroll)
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
  }, [mounted, hasMore, isValidating, size, setSize, hasInfiniteScroll]);

  const handleMouseEnter = (id: string) => {
    if (!mounted || isMobile)
      return;
    setHoveredId(id);
    setSelectedId(id);
  };

  // ── Render ──
  const isLeftPreview = previewPosition === "left";

  const previewContent = (
    <AnimatePresence mode="wait">
      {activeItem
        ? renderPreview(activeItem)
        : (
            <div className="h-40 flex items-center justify-start text-muted-foreground opacity-50">
              <span className="flex items-center gap-2">
                <Icon icon="mingcute:arrow-left-line" className="w-4 h-4" />
                {emptyMessage ?? t("interactive.empty.item")}
              </span>
            </div>
          )}
    </AnimatePresence>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className={cn(
        "grid grid-cols-1 relative items-start",
        isLeftPreview
          ? "lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] gap-6 md:gap-8"
          : "lg:grid-cols-12 gap-8 lg:gap-16",
      )}
      >
        {isLeftPreview && (
          <aside className="hidden lg:block sticky top-24 h-fit pr-4 self-start">
            {previewContent}
          </aside>
        )}

        <div className={cn("flex flex-col", !isLeftPreview && "lg:col-span-5")}>
          <div
            ref={listRef}
            className={cn(
              "relative",
              isLeftPreview
                ? "space-y-0 lg:space-y-1 lg:border-l lg:border-border/50"
                : "flex flex-col space-y-1",
            )}
            onMouseLeave={() => setHoveredId(null)}
          >
            {isLeftPreview && (
              <div
                ref={indicatorRef}
                className="hidden lg:block absolute left-0 w-0.75 bg-accent-500 rounded-r-full shadow-[0_0_10px_rgba(45,212,191,0.5)] pointer-events-none z-10 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200 ease-out"
                style={{
                  top: "var(--indicator-top, 0)",
                  height: "var(--indicator-height, 0)",
                  opacity: 0,
                }}
              />
            )}

            {items.map((item, index) => {
              const key = getItemKey(item);
              const isActive = mounted && activeItem ? getItemKey(activeItem) === key : false;
              const itemUrl = getItemUrl(item);
              const isLastFewItems = index >= items.length - 3;

              return (
                <Link
                  key={key}
                  ref={(el) => {
                    if (el)
                      itemRef.current.set(key, el);
                  }}
                  href={itemUrl}
                  prefetch={false}
                  onMouseEnter={() => {
                    router.prefetch(itemUrl);
                    handleMouseEnter(key);
                    if (isLastFewItems && hasInfiniteScroll)
                      prefetchNextPage();
                  }}
                  className={cn(
                    "group relative block outline-none",
                    isLeftPreview && "border-b border-dashed border-border/30 lg:border-0 last:border-0",
                  )}
                >
                  {isLeftPreview && (
                    <motion.div
                      className="absolute -inset-y-1 md:-inset-y-2 -inset-x-2 md:-inset-x-4 rounded-xl -z-10"
                      animate={{
                        backgroundColor: isActive && !isMobile ? "var(--bg-glass)" : "rgba(0,0,0,0)",
                      }}
                      style={{
                        backgroundColor: isActive && !isMobile ? "rgba(var(--primary-100), 0.5)" : "rgba(0,0,0,0)",
                      }}
                    />
                  )}
                  {renderListItem(item, { isActive: isActive && !isMobile, index })}
                </Link>
              );
            })}

            {hasInfiniteScroll && (
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center py-6 min-h-20",
                  isLeftPreview && "pl-3 md:pl-6",
                )}
                onMouseEnter={prefetchNextPage}
              >
                <div ref={loadMoreRef} className="absolute bottom-0 left-0 w-full h-24 pointer-events-none opacity-0 z-[-1]" />
                <div className="relative w-full flex justify-center items-center">
                  <div className={cn(
                    "flex items-center gap-2 text-sm text-muted-foreground transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200 absolute",
                    mounted && isValidating ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-2 invisible",
                  )}
                  >
                    {mounted && <Icon icon="mingcute:loading-line" className="w-4 h-4 animate-spin" />}
                    <span>{t("interactive.loading")}</span>
                  </div>
                  <div className={cn(
                    "text-sm text-muted-foreground/50 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] duration-200",
                    mounted && isValidating ? "opacity-0 invisible delay-0" : "opacity-100 visible delay-300",
                  )}
                  >
                    {!hasMore
                      ? (
                          <span>{t("interactive.loadedAll", { count: items.length })}</span>
                        )
                      : <span>{t("interactive.scrollToLoadMore")}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isLeftPreview && (
          <aside className="hidden lg:block lg:col-span-7 sticky top-24">
            {previewContent}
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Shared Internal Components ──────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function TitleDateListItem({ title, created, modified, isActive }: {
  title: string;
  created: string;
  modified?: string;
  isActive: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 md:gap-6 py-3 md:py-2 pl-3 md:pl-6">
      <h3 className={cn(
        "text-base md:text-lg min-w-0 flex-1 truncate transition-colors duration-200",
        isActive ? "text-accent-600 font-semibold" : "text-foreground/80 font-medium",
      )}
      >
        {title}
      </h3>
      <div className={cn(
        "shrink-0 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm transition-colors min-w-12.5 md:min-w-15 justify-end",
        isActive ? "text-accent-600/80" : "text-muted-foreground/50",
      )}
      >
        <SmartDate date={created} modifiedDate={modified} className="font-mono" />
      </div>
    </div>
  );
}

// ─── Post Preview ────────────────────────────────────────────────────

function PostPreview({ post }: { post: Post }) {
  const t = useTranslations();

  return (
    <motion.div
      key={post._id}
      initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-col items-start gap-1 text-sm font-mono text-muted-foreground">
        <div className="flex items-center gap-2" title={t("interactive.post.publishedAt")}>
          <Icon icon="mingcute:calendar-line" className="w-4 h-4" />
          <span>{formatDate(post.created)}</span>
        </div>
        {post.modified && (
          <div className="flex items-center gap-2 text-xs opacity-70" title={t("interactive.post.modifiedAt")}>
            <Icon icon="mingcute:edit-2-line" className="w-3.5 h-3.5" />
            <span>{formatDate(post.modified)}</span>
          </div>
        )}
      </div>

      <h2 className="text-3xl font-bold leading-tight text-foreground">{post.title}</h2>

      {post.category && (
        <div className="flex justify-start">
          <Link
            href={`/categories/${post.category.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 transition-colors hover:bg-primary-200"
          >
            <Icon icon="mingcute:folder-2-line" className="w-3.5 h-3.5" />
            {post.category.name}
          </Link>
        </div>
      )}

      <div className="text-primary-600 text-sm leading-7">
        {post.aiSummary && !post.summary && (
          <div className="flex items-center gap-1.5 mb-2">
            <Icon icon="mingcute:sparkles-fill" className="w-3.5 h-3.5 text-accent-500" />
            <span className="text-xs font-medium text-accent-600">{t("interactive.post.aiSummary")}</span>
          </div>
        )}
        <div className="text-left line-clamp-6">
          {post.aiSummary || post.summary
            ? <MarkdownPreviewClient content={post.aiSummary || post.summary || ""} maxLength={300} />
            : <p>{t("interactive.post.noSummary")}</p>}
        </div>
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap justify-start gap-2 pt-2">
          {post.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 text-xs text-accent-600 bg-accent-50 px-2 py-1 rounded-md border border-accent-100">
              <Icon icon="mingcute:tag-line" className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Note Preview ────────────────────────────────────────────────────

function NotePreview({ note }: { note: Note }) {
  const t = useTranslations();

  return (
    <motion.div
      key={note._id}
      initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-col items-start gap-1 text-sm font-mono text-muted-foreground">
        <div className="flex items-center gap-2" title={t("interactive.post.publishedAt")}>
          <Icon icon="mingcute:calendar-line" className="w-4 h-4" />
          <span>{formatDate(note.created)}</span>
        </div>
        {note.modified && (
          <div className="flex items-center gap-2 text-xs opacity-70" title={t("interactive.post.modifiedAt")}>
            <Icon icon="mingcute:edit-2-line" className="w-3.5 h-3.5" />
            <span>{formatDate(note.modified)}</span>
          </div>
        )}
      </div>

      <h2 className="text-3xl font-bold leading-tight text-foreground">{note.title}</h2>

      <div className="flex flex-wrap justify-start gap-2">
        {note.mood && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
            <Icon icon="mingcute:emoji-line" className="w-3.5 h-3.5" />
            {note.mood}
          </span>
        )}
        {note.weather && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Icon icon="mingcute:cloud-line" className="w-3.5 h-3.5" />
            {note.weather}
          </span>
        )}
        {note.location && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Icon icon="mingcute:location-line" className="w-3.5 h-3.5" />
            {note.location}
          </span>
        )}
      </div>

      <div className="text-primary-600 text-sm leading-7">
        {note.aiSummary && (
          <div className="flex items-center gap-1.5 mb-2">
            <Icon icon="mingcute:sparkles-fill" className="w-3.5 h-3.5 text-accent-500" />
            <span className="text-xs font-medium text-accent-600">{t("interactive.post.aiSummary")}</span>
          </div>
        )}
        <div className="text-left line-clamp-6">
          <MarkdownPreviewClient content={note.aiSummary || note.text} maxLength={200} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Convenience Wrappers ────────────────────────────────────────────

interface PostInteractiveListProps {
  items: Post[];
  emptyMessage?: string;
  staticMode?: boolean;
  pageSize?: number;
}

export function PostInteractiveList({
  items,
  emptyMessage,
  staticMode = false,
  pageSize = 10,
}: PostInteractiveListProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <InteractiveList<Post>
      items={items}
      getItemKey={p => p._id}
      getItemUrl={p => `/posts/${p.category?.slug || "default"}/${p.slug}`}
      renderPreview={post => <PostPreview post={post} />}
      renderListItem={(post, { isActive }) => (
        <TitleDateListItem title={post.title} created={post.created} modified={post.modified} isActive={isActive} />
      )}
      emptyMessage={emptyMessage ?? t("interactive.empty.post")}
      infiniteScroll={!staticMode
        ? {
            pageSize,
            fetcher: async (page, size) => {
              const res = await fetchPosts(page, size, locale);
              return { items: res.data.items as Post[], hasNextPage: res.data.pagination.has_next_page };
            },
            keyPrefix: `post-${locale}`,
          }
        : undefined}
    />
  );
}

interface NoteInteractiveListProps {
  items: Note[];
  emptyMessage?: string;
  pageSize?: number;
}

export function NoteInteractiveList({
  items,
  emptyMessage,
  pageSize = 10,
}: NoteInteractiveListProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <InteractiveList<Note>
      items={items}
      getItemKey={n => n._id}
      getItemUrl={n => `/notes/${n.nid}`}
      renderPreview={note => <NotePreview note={note} />}
      renderListItem={(note, { isActive }) => (
        <TitleDateListItem title={note.title} created={note.created} modified={note.modified} isActive={isActive} />
      )}
      emptyMessage={emptyMessage ?? t("interactive.empty.note")}
      infiniteScroll={{
        pageSize,
        fetcher: async (page, size) => {
          const res = await fetchNotes(page, size, locale);
          return { items: res.data.items as Note[], hasNextPage: res.data.pagination.has_next_page };
        },
        keyPrefix: `note-${locale}`,
      }}
    />
  );
}

// ─── Category Interactive List ────────────────────────────────────────

interface CategoryInteractiveListProps {
  items: Category[];
  allPosts: Post[];
  countMap: Record<string, number>;
  latestPostMap: Record<string, Post>;
  emptyMessage?: string;
}

export function CategoryInteractiveList({
  items,
  allPosts,
  countMap,
  latestPostMap,
  emptyMessage,
}: CategoryInteractiveListProps) {
  const t = useTranslations();

  return (
    <InteractiveList<Category>
      items={items}
      getItemKey={cat => cat.slug}
      getItemUrl={cat => `/categories/${cat.slug}`}

      emptyMessage={emptyMessage ?? t("interactive.empty.category")}
      renderListItem={(category, { isActive }) => {
        const count = countMap[category.slug] || 0;
        return (
          <div className="flex items-baseline justify-between gap-3 md:gap-6 py-3 md:py-2 pl-3 md:pl-6">
            <h2 className={cn(
              "text-base md:text-lg min-w-0 flex-1 truncate transition-colors duration-200",
              isActive ? "text-accent-600 font-semibold" : "text-foreground/80 font-medium",
            )}
            >
              {category.name}
            </h2>
            <span className={cn(
              "shrink-0 font-mono text-xs md:text-sm transition-colors",
              isActive ? "text-accent-600/80" : "text-muted-foreground/50",
            )}
            >
              {count}
              {t("nav.postsUnit")}
            </span>
          </div>
        );
      }}
      renderPreview={(category) => {
        const latestPost = latestPostMap[category.slug];
        const count = countMap[category.slug] || 0;
        const ranking = items.findIndex(c => c.slug === category.slug) + 1;
        const weight = allPosts.length > 0 ? Math.round((count / allPosts.length) * 100) : 0;
        return (
          <motion.div
            key={category.slug}
            initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-6"
          >
            <div className="flex flex-col items-start gap-1 text-sm font-mono text-muted-foreground">
              <div className="flex items-center gap-2">
                <Icon icon="mingcute:document-line" className="w-4 h-4" />
                <span>
                  {t("interactive.category.postsCount", { count })}
                </span>
              </div>
              {latestPost && (
                <div className="flex items-center gap-2 text-xs opacity-70">
                  <Icon icon="mingcute:calendar-line" className="w-3.5 h-3.5" />
                  <span>
                    {t("interactive.category.latestUpdate", { date: formatDate(latestPost.created) })}
                  </span>
                </div>
              )}
            </div>

            <h2 className="text-3xl font-bold leading-tight text-foreground">{category.name}</h2>

            <div className="flex flex-wrap justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                <Icon icon="mingcute:bling-line" className="w-3.5 h-3.5" />
                #
                {ranking}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                <Icon icon="mingcute:chart-bar-line" className="w-3.5 h-3.5" />
                {t("interactive.category.proportion", { value: weight })}
              </span>
            </div>

            <div className="text-primary-600 text-sm leading-7">
              {latestPost
                ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon icon="mingcute:news-line" className="w-3.5 h-3.5 text-accent-500" />
                        <span className="text-xs font-medium text-accent-600">{t("interactive.category.latestPost")}</span>
                      </div>
                      <p className="text-left font-medium line-clamp-1">{latestPost.title}</p>
                      {(latestPost.aiSummary || latestPost.summary) && (
                        <p className="text-left line-clamp-5 mt-1 opacity-80">
                          {truncateText(stripMarkdown(latestPost.aiSummary || latestPost.summary || ""), 300)}
                        </p>
                      )}
                    </>
                  )
                : (
                    <p className="text-left opacity-60">{t("interactive.category.noPosts")}</p>
                  )}
            </div>

            <Link
              href={`/categories/${category.slug}`}
              className="inline-flex items-center gap-2 text-sm text-accent-600 hover:text-accent-700 font-medium transition-colors"
            >
              {t("interactive.category.browseAll")}
              <Icon icon="mingcute:arrow-right-line" className="w-4 h-4" />
            </Link>
          </motion.div>
        );
      }}
    />
  );
}
