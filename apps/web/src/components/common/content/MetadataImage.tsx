"use client";

import type { ImgHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { hasImageDimensions } from "@/utils/images/bounds";
import { BlurhashPlaceholder } from "./BlurhashPlaceholder";
import { useImageMetadata } from "./ImageMetadataProvider";

interface MetadataImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  reserveRatio?: boolean;
}

/** Reuse the saved image table for gallery/grid/masonry HTML without replacing their existing interactions. */
export function MetadataImage({ src, alt, className = "", reserveRatio = false, onLoad, style, ...props }: MetadataImageProps) {
  const metadata = useImageMetadata(src);
  const dimensions = hasImageDimensions(metadata) ? metadata : undefined;
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth) {
      queueMicrotask(() => setLoadedSrc(src));
    }
  }, [src]);
  return (
    <>
      <BlurhashPlaceholder hash={metadata?.blurhash} hidden={loadedSrc === src} />
      <img
        {...props}
        ref={image}
        src={src}
        alt={alt}
        width={dimensions?.width}
        height={dimensions?.height}
        data-blurhash={metadata?.blurhash || undefined}
        data-image-bytes={metadata?.bytes}
        loading={props.loading ?? "lazy"}
        className={`relative block max-w-full ${className} ${metadata?.blurhash && loadedSrc !== src ? "opacity-0" : ""}`}
        style={{ ...(reserveRatio ? { aspectRatio: dimensions ? `${dimensions.width} / ${dimensions.height}` : "4 / 3" } : {}), ...style }}
        onLoad={(event) => {
          setLoadedSrc(src);
          onLoad?.(event);
        }}
      />
    </>
  );
}
