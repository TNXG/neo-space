"use client";

import type { BangumiMediaCollection } from "@/types/bangumi";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { BangumiArtwork } from "./BangumiArtwork";

interface MediaCollectionDetailProps {
  item: BangumiMediaCollection;
  statusLabel: string;
  progress: string | null;
  locale: string;
  reduceMotion: boolean | null;
  mobile?: boolean;
  onClose?: () => void;
}

/** 展示作品完整信息，并按桌面侧栏或移动端底部面板调整信息密度。 */
export function MediaCollectionDetail({
  item,
  statusLabel,
  progress,
  locale,
  reduceMotion,
  mobile = false,
  onClose,
}: MediaCollectionDetailProps) {
  const t = useTranslations("bangumi");

  return (
    <motion.aside
      key={`${mobile ? "mobile" : "desktop"}-${item.subjectId}`}
      role={mobile ? "dialog" : undefined}
      aria-modal={mobile || undefined}
      aria-label={item.title}
      initial={
        reduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              y: mobile ? 28 : 10,
              scale: 0.985,
              filter: "blur(8px)",
            }
      }
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 24, filter: "blur(6px)" }
      }
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "overflow-hidden border border-border/40 bg-card/90 shadow-2xl backdrop-blur-2xl",
        mobile
          ? "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[2rem] lg:hidden"
          : "sticky top-24 hidden self-start rounded-3xl bg-card/55 shadow-none lg:block",
      )}
    >
      {mobile && (
        <div className="sticky top-0 z-10 flex h-11 items-center justify-between border-b border-border/30 bg-card/80 px-4 backdrop-blur-xl">
          <span
            className="h-1 w-10 rounded-full bg-muted-foreground/25"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("detail.close")}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-secondary/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
          >
            <Icon icon="mingcute:close-line" className="size-4" />
          </button>
        </div>
      )}

      <div
        className={cn(
          mobile && "grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 p-4 pb-0",
        )}
      >
        <BangumiArtwork
          src={
            item.kind === "game"
              ? item.images?.grid || item.images?.small || item.images?.common
              : item.images?.large || item.images?.common
          }
          alt={item.title}
          className={cn(
            "w-full",
            item.kind === "anime" && "aspect-[2/3]",
            item.kind === "book" && "aspect-[3/4]",
            item.kind === "game" && "aspect-square",
            mobile && "rounded-2xl",
          )}
          sizes={mobile ? "7.5rem" : "20rem"}
          priority={!mobile}
          variant={
            item.kind === "anime"
              ? "anime-cover"
              : item.kind === "book"
                ? "book-cover"
                : "game-icon"
          }
        />
        <div className={cn("space-y-4 p-5", mobile && "self-center p-0")}>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-600">
              {statusLabel}
            </p>
            <h2 className="mt-1 line-clamp-3 overflow-hidden text-ellipsis break-words text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
              {item.title}
            </h2>
            {item.originalTitle !== item.title && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {item.originalTitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {item.score > 0 && (
              <span>{t("detail.score", { score: item.score.toFixed(1) })}</span>
            )}
            {item.rank > 0 && <span>#{item.rank}</span>}
            {progress && <span>{progress}</span>}
          </div>
        </div>
      </div>

      <div className={cn("space-y-4 p-5", mobile && "pt-4")}>
        {item.summary && (
          <p
            className={cn(
              "overflow-hidden text-ellipsis text-sm leading-[1.65] text-muted-foreground",
              mobile ? "line-clamp-8" : "line-clamp-6",
            )}
          >
            {item.summary}
          </p>
        )}
        {item.comment && (
          <blockquote className="rounded-2xl bg-secondary/55 px-4 py-3 text-sm leading-[1.65] text-foreground/85">
            “{item.comment}”
          </blockquote>
        )}
        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border/50 px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        <a
          href={`https://bgm.tv/subject/${item.subjectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.985]"
        >
          {t("detail.openBangumi")}
          <Icon icon="mingcute:external-link-line" className="size-4" />
        </a>
        <p className="text-center text-[10px] text-muted-foreground/70">
          {t("detail.collectedAt", {
            date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(item.updatedAt),
            ),
          })}
        </p>
      </div>
    </motion.aside>
  );
}
