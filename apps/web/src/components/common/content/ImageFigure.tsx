"use client";

import ExifReader from "exifreader";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/inline-icon";
import type { ImageMetadata } from "@/types/api";
import { getImageBounds, hasImageDimensions } from "@/utils/images/bounds";
import { BlurhashPlaceholder } from "./BlurhashPlaceholder";
import type { ExifData } from "./image-exif";
import { extractMetadataByPriority } from "./image-exif";
import { LightboxPortal } from "./ImageLightbox";
import { useImageMetadata } from "./ImageMetadataProvider";

interface ImageFigureProps {
  src: string;
  alt?: string;
  className?: string;
  isBlock?: boolean;
  metadata?: ImageMetadata;
}

/** Resolve saved metadata for both ordinary Markdown images and images nested inside containers. */
export function ImageFigure(props: ImageFigureProps) {
  const saved = useImageMetadata(props.src);
  return <ImageFigureContent key={props.src} {...props} metadata={props.metadata ?? saved} />;
}

/** Render stable server-reserved geometry while preserving retry, EXIF and lightbox interactions. */
function ImageFigureContent({ src, alt, className = "", isBlock = true, metadata }: ImageFigureProps) {
  const t = useTranslations();
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>();
  const dimensions = hasImageDimensions(metadata) ? metadata : naturalDimensions;
  const bounds = getImageBounds(dimensions);
  const isSmall = !!dimensions && (dimensions.height < 64 || (dimensions.width < 150 && dimensions.height < 150));
  const block = isBlock && !isSmall;
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [exif, setExif] = useState<ExifData | null>(null);
  const mounted = typeof window !== "undefined";
  const imgRef = useRef<HTMLImageElement>(null);
  const hasCheckedCacheRef = useRef(false);

  const loadExifData = useCallback(async () => {
    if (isSmall || !src) return;
    try {
      const response = await fetch(src, { headers: { Range: "bytes=0-524288" } });
      const buffer = await response.arrayBuffer();
      const tags = ExifReader.load(buffer, { expanded: true });
      const data = extractMetadataByPriority(tags);
      if (data.model || data.iso || data.fNumber) setExif(data);
    } catch (error) {
      console.warn("Metadata parsing failed:", error);
    }
  }, [src, isSmall]);

  const handleImageComplete = useCallback(() => {
    hasCheckedCacheRef.current = true;
    setIsLoaded(true);
    setIsError(false);
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (!hasImageDimensions(metadata) && naturalWidth > 0 && naturalHeight > 0) {
        setNaturalDimensions({ width: naturalWidth, height: naturalHeight });
      }
      // 未扫描图片沿用原有自然尺寸回退；已有 meta 的图片加载前后保持同一布局。
      if (naturalHeight < 64 || (naturalWidth < 150 && naturalHeight < 150)) return;
    }
    if (typeof window.requestIdleCallback !== "undefined") {
      window.requestIdleCallback(() => { void loadExifData(); });
    } else {
      setTimeout(() => { void loadExifData(); }, 0);
    }
  }, [loadExifData, metadata]);

  useEffect(() => {
    if (!hasCheckedCacheRef.current && imgRef.current?.complete) {
      hasCheckedCacheRef.current = true;
      if (imgRef.current.naturalWidth === 0) {
        queueMicrotask(() => {
          setIsError(true);
          setIsLoaded(true);
        });
      } else {
        queueMicrotask(handleImageComplete);
      }
    }
  }, [handleImageComplete]);

  const handleRetry = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    hasCheckedCacheRef.current = false;
    setIsError(false);
    setIsLoaded(false);
    setRetryKey(previous => previous + 1);
  }, []);

  const ContainerTag = block ? "figure" : "span";
  return (
    <>
      <ContainerTag
        className={`group relative min-w-0 max-w-full ${block ? "flex flex-col items-center justify-center gap-3" : "inline-flex align-middle"} ${className || (block ? "my-8" : "")}`}
        style={block ? undefined : { width: `min(100%, ${bounds.width}px)` }}
      >
        <span
          className={`relative block max-w-full overflow-hidden border border-border bg-muted ${isSmall ? "rounded-md" : "rounded-xl"}`}
          style={{ width: `min(100%, ${bounds.width}px)`, aspectRatio: `${bounds.width} / ${bounds.height}` }}
        >
          <BlurhashPlaceholder hash={metadata?.blurhash} hidden={isLoaded && !isError} />
          <img
            key={retryKey}
            ref={imgRef}
            src={src}
            alt={alt}
            width={dimensions?.width}
            height={dimensions?.height}
            data-blurhash={metadata?.blurhash || undefined}
            data-image-bytes={metadata?.bytes}
            onLoad={handleImageComplete}
            onError={() => {
              setIsError(true);
              setIsLoaded(true);
            }}
            className={`absolute inset-0 block size-full max-w-full object-contain transition-opacity duration-200 ${isLoaded && !isError ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
          />
          {isError ? (
            <button
              type="button"
              className="absolute inset-0 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 bg-muted/70 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={handleRetry}
              title={t("common.imageFigure.retryLoad")}
              aria-label={t("common.imageFigure.retryLoad")}
            >
              <Icon icon="mingcute:close-circle-dash-line" className={block ? "size-8 md:size-10" : "size-5"} />
              {block && <span className="text-xs font-medium md:text-sm">{t("common.imageFigure.reload")}</span>}
            </button>
          ) : (
            <button
              type="button"
              className="absolute inset-0 z-20 block w-full cursor-pointer"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen(true);
              }}
              title={t("common.imageFigure.zoomIn")}
              aria-label={t("common.imageFigure.zoomIn")}
            />
          )}
          {exif && !isError && (
            <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded bg-foreground/70 px-1.5 py-0.5 font-mono text-[9px] text-background opacity-0 transition-opacity group-hover:opacity-100 md:text-[10px]">EXIF</span>
          )}
        </span>
        {block && alt && (
          <>
            <span className="h-px w-12 bg-border md:w-16" />
            <figcaption className="max-w-[95%] px-2 text-center text-xs text-muted-foreground md:max-w-[90%] md:text-sm">{alt}</figcaption>
          </>
        )}
      </ContainerTag>
      {mounted && isOpen && !isError && (
        <LightboxPortal src={src} alt={alt} exif={exif} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
