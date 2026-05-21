"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { KbdShortcut } from "@/components/ui/kbd";
import { Icon } from "@/lib/inline-icon";

interface GalleryImage {
  url: string;
  alt?: string;
}

interface GalleryProps {
  images: GalleryImage[];
  className?: string;
}

/**
 * Gallery 组件 - 图片画廊展示
 */
export function Gallery({ images, className }: GalleryProps) {
  const t = useTranslations();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // 阻止背景滚动
  useEffect(() => {
    if (selectedIndex !== null) {
      document.body.style.overflow = "hidden";

      const preventScroll = (e: WheelEvent | TouchEvent) => {
        e.preventDefault();
      };

      document.body.addEventListener("wheel", preventScroll, { passive: false });
      document.body.addEventListener("touchmove", preventScroll, { passive: false });

      return () => {
        document.body.style.overflow = "";
        document.body.removeEventListener("wheel", preventScroll);
        document.body.removeEventListener("touchmove", preventScroll);
      };
    }
  }, [selectedIndex]);

  if (images.length === 0) {
    return null;
  }

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedIndex(null);
      setIsClosing(false);
    }, 200);
  };
  const handlePrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  };
  const handleNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  };

  return (
    <>
      <div className={clsx("my-8 grid gap-4", className)}>
        <div
          className={clsx(
            "grid gap-4",
            images.length === 1 && "grid-cols-1",
            images.length === 2 && "grid-cols-2",
            images.length >= 3 && "grid-cols-2 md:grid-cols-3",
          )}
        >
          {images.map((image, idx) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className="relative aspect-video overflow-hidden rounded-xl bg-surface-100 cursor-pointer group"
            >
              <img
                src={image.url}
                alt={image.alt || t("common.gallery.imageAlt", { index: idx + 1 })}
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 duration-200 ${isClosing ? "animate-out fade-out" : "animate-in fade-in"}`}
          onClick={handleClose}
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors cursor-pointer z-50"
            aria-label={t("common.gallery.close")}
          >
            <Icon icon="mingcute:close-line" width={32} height={32} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 text-white/80 hover:text-white transition-colors cursor-pointer z-50"
            aria-label={t("common.gallery.previous")}
          >
            <Icon icon="mingcute:left-line" width={32} height={32} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 text-white/80 hover:text-white transition-colors cursor-pointer z-50"
            aria-label={t("common.gallery.next")}
          >
            <Icon icon="mingcute:right-line" width={32} height={32} />
          </button>

          <div className="relative max-w-6xl max-h-[90vh] w-full h-full" onClick={e => e.stopPropagation()}>
            <img
              src={images[selectedIndex].url}
              alt={images[selectedIndex].alt || t("common.gallery.imageAlt", { index: selectedIndex + 1 })}
              className="object-contain w-full h-full"
              sizes="90vw"
            />
          </div>

          {/* 操作提示 */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 text-white/70 text-xs select-none px-4">
            <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm">
              <Icon icon="mingcute:arrow-left-line" width={14} height={14} />
              <Icon icon="mingcute:arrow-right-line" width={14} height={14} />
              <span>{t("common.gallery.switchImage")}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg backdrop-blur-sm">
              <KbdShortcut keys={["Esc"]} variant="lightbox" />
              <span>{t("common.gallery.close")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
