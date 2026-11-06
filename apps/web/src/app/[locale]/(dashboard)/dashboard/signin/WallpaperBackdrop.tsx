"use client";

import { useEffect, useRef } from "react";
import { useSigninWallpaperState } from "@/components/dashboard/sign/SigninWallpaperProvider";

/** 首帧探测间隔：JXL 渐进解码拿到尺寸/首帧后立即结束轮询。 */
const PAINT_POLL_MS = 80;

/** 全屏壁纸：JXL 直链由浏览器渐进解码，边下载边出图，不做透明度门控。 */
export function WallpaperBackdrop() {
  const { wallpaper, markPainted } = useSigninWallpaperState();
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const element = image.current;
    if (!element) return;
    // load 只在整张解码完成时触发；轮询 naturalWidth 才能在首帧可绘制时就通知卡片。
    const markOnceReady = () => {
      if (element.naturalWidth > 0) {
        markPainted();
        return true;
      }
      return false;
    };
    if (markOnceReady()) return;
    const timer = window.setInterval(() => {
      if (markOnceReady()) window.clearInterval(timer);
    }, PAINT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [wallpaper?.fallbackUrl, markPainted]);

  if (!wallpaper?.jxlUrl || !wallpaper.fallbackUrl) return null;

  return (
    <>
      <picture>
        <source srcSet={wallpaper.jxlUrl} type="image/jxl" />
        <img
          ref={image}
          src={wallpaper.fallbackUrl}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full select-none object-cover"
        />
      </picture>
      {/* 轻量上下压暗，保证页眉与边缘文字在复杂壁纸上仍有对比度 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-background/25 via-transparent to-background/35" />
    </>
  );
}
