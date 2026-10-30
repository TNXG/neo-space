"use client";

import { clsx } from "clsx";
import { MetadataImage } from "./MetadataImage";

interface MasonryImagesProps {
  images: string[];
  gap?: number;
  className?: string;
}

/**
 * MasonryImages 组件 - 瀑布流布局图片展示
 */
export function MasonryImages({ images, gap = 8, className }: MasonryImagesProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div
      className={clsx("columns-1 sm:columns-2 md:columns-3 my-6", className)}
      style={{ columnGap: `${gap}px` }}
    >
      {images.map((src, idx) => (
        <div
          key={src}
          className="relative mb-4 min-w-0 break-inside-avoid overflow-hidden rounded-xl bg-muted"
          style={{ marginBottom: `${gap}px` }}
        >
          <MetadataImage
            src={src}
            alt={`Masonry image ${idx + 1}`}
            reserveRatio
            className="w-full h-auto"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          />
        </div>
      ))}
    </div>
  );
}
