"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/lib/inline-icon";

import { fetchMediaCard } from "./media-card.client";
import type { MediaCardData } from "./types";

interface MediaCardProps {
  url: string;
  initialData?: MediaCardData;
}

/** 外部元数据不可用时保留可访问的原始链接。 */
const MediaCardFallback = ({ url }: { url: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="my-5 flex cursor-pointer items-center gap-2 rounded-xl bg-card/60 px-4 py-3 text-sm text-primary transition-colors hover:bg-muted"
  >
    <Icon icon="mingcute:link-2-line" className="size-4 shrink-0" aria-hidden />
    <span className="min-w-0 truncate">{url}</span>
    <Icon icon="mingcute:external-link-line" className="ml-auto size-4 shrink-0" aria-hidden />
  </a>
);

/** 渲染完整影视卡片，使用原生图片以遵循 Markdown 媒体的统一加载策略。 */
const MediaCardContent = ({ media }: { media: MediaCardData }) => {
  const year = media.releaseDate?.slice(0, 4);

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative my-6 flex min-h-44 w-full cursor-pointer overflow-hidden rounded-2xl bg-card/80 text-card-foreground backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`在 ${media.sourceLabel} 查看 ${media.title}`}
    >
      {media.backdropUrl && (
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <img
            src={media.backdropUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover opacity-[0.08] blur-sm"
          />
          <div className="absolute inset-0 bg-linear-to-r from-card via-card/95 to-card/70" />
        </div>
      )}

      <div className="relative m-3 h-40 w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:m-4 sm:h-48 sm:w-32">
        {media.posterUrl
          ? (
              <img
                src={media.posterUrl}
                alt={`${media.title} 海报`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )
          : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Icon icon="mingcute:tv-2-line" className="size-9" aria-hidden />
              </div>
            )}
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col py-4 pr-4 sm:py-5 sm:pr-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="rounded-full bg-background/60 px-2.5 py-1 backdrop-blur-sm">
            {media.sourceLabel}
          </span>
          {media.mediaType && <span>{media.mediaType}</span>}
          {year && <span>· {year}</span>}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-lg font-bold leading-snug text-foreground sm:text-xl">
              {media.title}
            </h3>
            {media.originalTitle && media.originalTitle !== media.title && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                {media.originalTitle}
              </p>
            )}
          </div>
          <Icon
            icon="mingcute:external-link-line"
            className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden
          />
        </div>

        {media.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:line-clamp-2">
            {media.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs">
          {media.rating !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
              <Icon icon="mingcute:star-fill" className="size-3" aria-hidden />
              {media.rating.toFixed(1)}
            </span>
          )}
          {media.genres.slice(0, 3).map(genre => (
            <span key={genre} className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {genre}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
};

/**
 * 同构影视卡片：SSR 时直接使用初始数据，纯客户端渲染时自动请求官方 API。
 */
export const MediaCard = ({ url, initialData }: MediaCardProps) => {
  const [media, setMedia] = useState<MediaCardData | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData)
      return;

    const abortController = new AbortController();
    void fetchMediaCard(url, abortController.signal)
      .then((result) => {
        if (!abortController.signal.aborted)
          setMedia(result);
      })
      .catch(() => {
        if (!abortController.signal.aborted)
          setMedia(null);
      })
      .finally(() => {
        if (!abortController.signal.aborted)
          setIsLoading(false);
      });

    return () => abortController.abort();
  }, [initialData, url]);

  if (media)
    return <MediaCardContent media={media} />;

  if (isLoading) {
    return (
      <div className="my-6 flex min-h-44 w-full animate-pulse overflow-hidden rounded-2xl bg-card/60" aria-label="正在加载影视卡片">
        <div className="m-3 h-40 w-28 shrink-0 rounded-xl bg-muted sm:m-4 sm:h-48 sm:w-32" />
        <div className="flex flex-1 flex-col gap-3 py-5 pr-5">
          <div className="h-5 w-20 rounded-full bg-muted" />
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-4/5 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return <MediaCardFallback url={url} />;
};
