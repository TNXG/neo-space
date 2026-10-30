"use client";

import { useEffect, useRef } from "react";
import { decodeBlurhash } from "@/utils/images/blurhash";

const PREVIEW_EDGE = 128;

/** Paint a tiny decorative canvas over the server-reserved image area without downloading another asset. */
export function BlurhashPlaceholder({ hash, hidden = false }: { hash?: string; hidden?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    // 始终按实际位图尺寸解码，避免缓存 HTML 与客户端分辨率不同导致只画出左上角。
    const { width, height } = element;
    context.clearRect(0, 0, width, height);
    if (!hash) return;
    const pixels = decodeBlurhash(hash, width, height);
    if (!pixels) return;
    const image = context.createImageData(width, height);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  }, [hash]);

  if (!hash) return null;
  return (
    <canvas
      ref={canvas}
      width={PREVIEW_EDGE}
      height={PREVIEW_EDGE}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full ${hidden ? "invisible" : ""}`}
    />
  );
}
