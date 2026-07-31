import type { CSSProperties } from "react";
import Image from "next/image";
import type { BangumiImageCrop } from "@/types/bangumi";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

interface BangumiArtworkProps {
  src?: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  variant?: "anime-cover" | "book-cover" | "game-icon" | "portrait";
  crop?: BangumiImageCrop;
}

/** 统一处理 Bangumi 图片与无图占位，避免各类卡片出现不同的降级样式。 */
export function BangumiArtwork({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 12rem, 40vw",
  priority = false,
  variant = "anime-cover",
  crop,
}: BangumiArtworkProps) {
  const cropRectangle =
    crop &&
    crop.cropLeft !== undefined &&
    crop.cropTop !== undefined &&
    crop.cropWidth !== undefined &&
    crop.cropHeight !== undefined &&
    crop.cropWidth > 0 &&
    crop.cropHeight > 0
      ? {
          left: crop.cropLeft,
          top: crop.cropTop,
          width: crop.cropWidth,
          height: crop.cropHeight,
        }
      : undefined;
  const hasCropRectangle = cropRectangle !== undefined;
  const cropStyle: CSSProperties | undefined = cropRectangle
    ? {
        left: `${-(cropRectangle.left / cropRectangle.width) * 100}%`,
        top: `${-(cropRectangle.top / cropRectangle.height) * 100}%`,
        width: `${100 / cropRectangle.width}%`,
        height: `${100 / cropRectangle.height}%`,
        maxWidth: "none",
      }
    : crop
      ? { objectPosition: `${crop.centerX * 100}% ${crop.centerY * 100}%` }
      : undefined;

  return (
    <div className={cn("relative overflow-hidden bg-secondary/60", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={1000}
          height={1000}
          sizes={sizes}
          priority={priority}
          unoptimized
          style={cropStyle}
          className={cn(
            "absolute inset-0 h-full w-full min-h-full min-w-full",
            variant === "anime-cover" && "object-cover object-top",
            variant === "book-cover" && "scale-100 object-contain",
            variant === "game-icon" && "scale-100 object-contain p-3",
            variant === "portrait" &&
              !hasCropRectangle &&
              "object-cover object-[center_20%]",
            variant === "portrait" && hasCropRectangle && "object-fill",
            !crop && variant === "anime-cover" && "scale-[1.12]",
            !crop && variant === "portrait" && "scale-[1.02]",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
          <Icon icon="mingcute:pic-line" className="size-8" />
        </div>
      )}
    </div>
  );
}
