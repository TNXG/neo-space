"use client";

import type {
  BangumiCollectionStatus,
  BangumiMediaCollection,
  BangumiMediaKind,
} from "@/types/bangumi";
import { useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/inline-icon";
import { BangumiSegmentedControl } from "./BangumiSegmentedControl";
import { MediaCollectionCard } from "./MediaCollectionCard";
import { MediaCollectionDetail } from "./MediaCollectionDetail";
import { MediaCollectionMobileDetail } from "./MediaCollectionMobileDetail";

const COLLECTION_STATUSES: BangumiCollectionStatus[] = [1, 2, 3, 4, 5];
const INITIAL_VISIBLE_COUNT = 18;

interface MediaCollectionViewProps {
  kind: BangumiMediaKind;
  items: BangumiMediaCollection[];
}

/** 根据作品类型返回符合中文习惯的收藏状态文案 key。 */
function getStatusKey(
  kind: BangumiMediaKind,
  status: BangumiCollectionStatus,
): string {
  const statusName = (
    { 1: "wish", 2: "done", 3: "doing", 4: "onHold", 5: "dropped" } as const
  )[status];
  return `status.${kind}.${statusName}`;
}

/** 生成作品进度文案；动画看集数、书籍看册数，游戏不展示伪进度。 */
function getProgress(
  item: BangumiMediaCollection,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (item.kind === "anime" && item.episodes > 0) {
    return t("progress.episodes", {
      current: item.episodeProgress,
      total: item.episodes,
    });
  }
  if (item.kind === "book" && item.volumes > 0) {
    return t("progress.volumes", {
      current: item.volumeProgress,
      total: item.volumes,
    });
  }
  return null;
}

/** 展示单一作品类型，并让收藏状态成为清晰的第二层级。 */
export function MediaCollectionView({ kind, items }: MediaCollectionViewProps) {
  const t = useTranslations("bangumi");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<"all" | BangumiCollectionStatus>("all");
  const [selectedId, setSelectedId] = useState<number | null>(
    items[0]?.subjectId ?? null,
  );
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const statusOptions = useMemo(
    () => [
      { value: "all" as const, label: t("filter.all"), count: items.length },
      ...COLLECTION_STATUSES.map((value) => ({
        value,
        label: t(getStatusKey(kind, value)),
        count: items.filter((item) => item.status === value).length,
      })),
    ],
    [items, kind, t],
  );
  const filteredItems = useMemo(
    () =>
      status === "all" ? items : items.filter((item) => item.status === status),
    [items, status],
  );
  const visibleItems = filteredItems.slice(0, visibleCount);
  const selectedItem =
    filteredItems.find((item) => item.subjectId === selectedId) ??
    filteredItems[0];

  useEffect(() => {
    setStatus("all");
    setSelectedId(items[0]?.subjectId ?? null);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setMobileDetailOpen(false);
  }, [items, kind]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || visibleCount >= filteredItems.length) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(count =>
            Math.min(count + INITIAL_VISIBLE_COUNT, filteredItems.length),
          );
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredItems.length, visibleCount]);

  /** 切换状态时将详情选择同步到新分组的第一项。 */
  const handleStatusChange = (nextStatus: "all" | BangumiCollectionStatus) => {
    const nextItems =
      nextStatus === "all"
        ? items
        : items.filter((item) => item.status === nextStatus);
    setStatus(nextStatus);
    setSelectedId(nextItems[0]?.subjectId ?? null);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setMobileDetailOpen(false);
  };

  /** 选择作品并在移动端打开便于阅读的底部详情面板。 */
  const handleOpenDetail = (subjectId: number) => {
    setSelectedId(subjectId);
    setMobileDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <BangumiSegmentedControl
        value={status}
        options={statusOptions}
        onChange={handleStatusChange}
        label={t("filter.statusLabel")}
        compact
      />

      {filteredItems.length > 0 && selectedItem ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid auto-rows-max grid-cols-2 items-start gap-3 self-start sm:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((item, index) => (
              <MediaCollectionCard
                key={item.subjectId}
                item={item}
                active={selectedItem.subjectId === item.subjectId}
                statusLabel={t(getStatusKey(kind, item.status))}
                index={index}
                reduceMotion={reduceMotion}
                onPreview={setSelectedId}
                onOpen={handleOpenDetail}
              />
            ))}
          </div>

          <MediaCollectionDetail
            item={selectedItem}
            statusLabel={t(getStatusKey(kind, selectedItem.status))}
            progress={getProgress(selectedItem, t)}
            locale={locale}
            reduceMotion={reduceMotion}
          />

          <MediaCollectionMobileDetail
            item={selectedItem}
            statusLabel={t(getStatusKey(kind, selectedItem.status))}
            progress={getProgress(selectedItem, t)}
            locale={locale}
            reduceMotion={reduceMotion}
            open={mobileDetailOpen}
            onClose={() => setMobileDetailOpen(false)}
          />
        </div>
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/25 px-6 text-center">
          <Icon
            icon="mingcute:inbox-line"
            className="size-8 text-muted-foreground/50"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("empty.status")}
          </p>
        </div>
      )}

      <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />
    </div>
  );
}
