import type { BangumiMediaCollection } from "@/types/bangumi";
import { motion } from "motion/react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { BangumiArtwork } from "./BangumiArtwork";

interface MediaCollectionCardProps {
  item: BangumiMediaCollection;
  active: boolean;
  statusLabel: string;
  index: number;
  reduceMotion: boolean | null;
  onPreview: (subjectId: number) => void;
  onOpen: (subjectId: number) => void;
}

/** 渲染单个作品收藏卡，并在悬停、键盘聚焦与点击时同步详情选择。 */
export function MediaCollectionCard({
  item,
  active,
  statusLabel,
  index,
  reduceMotion,
  onPreview,
  onOpen,
}: MediaCollectionCardProps) {
  return (
    <motion.button
      type="button"
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 10, filter: "blur(4px)" }
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.22,
        delay: reduceMotion ? 0 : Math.min(index, 8) * 0.025,
        ease: [0.23, 1, 0.32, 1],
      }}
      onMouseEnter={() => onPreview(item.subjectId)}
      onFocus={() => onPreview(item.subjectId)}
      onClick={() => onOpen(item.subjectId)}
      className={cn(
        "group h-fit self-start cursor-pointer overflow-hidden rounded-2xl border bg-card/45 text-left backdrop-blur-xl transition-[border-color,background-color] duration-200 active:scale-[0.985]",
        active
          ? "border-accent-500/60 bg-accent-500/5"
          : "border-border/40 hover:border-accent-500/30 hover:bg-card/70",
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
        )}
        variant={
          item.kind === "anime"
            ? "anime-cover"
            : item.kind === "book"
              ? "book-cover"
              : "game-icon"
        }
      />
      <div className="space-y-2 p-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.01em] text-foreground">
            {item.title}
          </h3>
          {item.date && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.date.slice(0, 4)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-accent-700">
            {statusLabel}
          </span>
          {item.rate > 0 && (
            <span className="flex items-center gap-1 font-medium tabular-nums text-muted-foreground">
              <Icon
                icon="mingcute:star-fill"
                className="size-3 text-accent-500"
              />
              {item.rate}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
