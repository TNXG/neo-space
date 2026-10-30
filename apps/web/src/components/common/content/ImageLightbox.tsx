"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KbdShortcut } from "@/components/ui/kbd";
import { Icon } from "@/lib/inline-icon";
import type { ExifData } from "./image-exif";

export { LightboxPortal };
// --- 灯箱组件 ---
function LightboxPortal({
  src,
  alt,
  exif,
  onClose,
}: {
  src: string;
  alt?: string;
  exif: ExifData | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const lastClickTimeRef = useRef(0);
  const touchStartDistanceRef = useRef(0);
  const touchStartScaleRef = useRef(1);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        handleClose();
    };

    // 阻止背景页面滚动
    const preventScroll = (e: WheelEvent | TouchEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleEsc);
    // 使用 passive: false 确保可以阻止默认行为
    document.body.addEventListener("wheel", preventScroll, { passive: false });
    document.body.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEsc);
      document.body.removeEventListener("wheel", preventScroll);
      document.body.removeEventListener("touchmove", preventScroll);
    };
  }, [handleClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY * 0.002;
    setScale((prevScale) => {
      const newScale = Math.max(1, Math.min(prevScale + delta, 5));
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // 如果刚拖拽过，不触发缩放
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    // 快速双击（250ms内）关闭灯箱
    if (timeSinceLastClick < 250) {
      handleClose();
      return;
    }

    lastClickTimeRef.current = now;

    // 单击切换缩放
    setScale((prev) => {
      if (prev > 1) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, [hasDragged, handleClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setHasDragged(false);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const deltaX = Math.abs(e.clientX - dragStartRef.current.x - position.x);
      const deltaY = Math.abs(e.clientY - dragStartRef.current.y - position.y);

      // 移动超过5px才算拖拽
      if (deltaX > 5 || deltaY > 5) {
        setHasDragged(true);
      }

      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
      e.stopPropagation();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 动态计算鼠标指针样式
  const getCursorStyle = () => {
    if (scale > 1) {
      return isDragging ? "grabbing" : "grab";
    }
    return "zoom-in";
  };

  // 计算两个触摸点之间的距离
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2)
      return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 触摸开始
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指捏合
      e.preventDefault();
      touchStartDistanceRef.current = getTouchDistance(e.touches);
      touchStartScaleRef.current = scale;
      touchStartPosRef.current = position;
    } else if (e.touches.length === 1 && scale > 1) {
      // 单指拖拽（仅在放大时）
      setIsDragging(true);
      setHasDragged(false);
      const touch = e.touches[0];
      dragStartRef.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    }
  };

  // 触摸移动
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指捏合缩放
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / touchStartDistanceRef.current;
      const newScale = Math.max(1, Math.min(touchStartScaleRef.current * scaleChange, 5));

      setScale(newScale);

      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // 单指拖拽
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - dragStartRef.current.x - position.x);
      const deltaY = Math.abs(touch.clientY - dragStartRef.current.y - position.y);

      if (deltaX > 5 || deltaY > 5) {
        setHasDragged(true);
      }

      setPosition({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y,
      });
    }
  };

  // 触摸结束
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      touchStartDistanceRef.current = 0;
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-md duration-200 ${isClosing ? "animate-out fade-out" : "animate-in fade-in"}`}
      onClick={handleClose}
      onWheel={handleWheel}
    >
      <button
        type="button"
        className="absolute top-3 right-3 md:top-5 md:right-5 p-1.5 md:p-2 rounded-full bg-black/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors z-50 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        aria-label={t("common.imageFigure.close")}
      >
        <Icon icon="mingcute:close-line" width={20} height={20} className="md:w-6 md:h-6" />
      </button>

      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50">
            <Icon icon="mingcute:loading-line" className="animate-spin" width={32} height={32} />
          </div>
        )}

        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={() => setImgLoaded(true)}
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            cursor: getCursorStyle(),
            transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.2, 0, 0, 1)",
            opacity: imgLoaded ? 1 : 0,
          }}
          className="max-w-[95vw] max-h-[95vh] object-contain select-none touch-none"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          draggable={false}
        />
      </div>

      <div
        className="absolute bottom-8 md:bottom-12 left-0 right-0 flex flex-col items-center gap-2 md:gap-3 animate-in slide-in-from-bottom-4 duration-200 pointer-events-auto z-50 px-4"
        onClick={e => e.stopPropagation()}
      >
        {/* 缩放提示 - 移动端显示捏合，桌面端显示滚轮 */}
        <div className="flex md:hidden items-center gap-2 text-white/70 text-xs select-none bg-black/30 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          <Icon icon="mingcute:finger-tap-line" width={14} height={14} />
          <span>{t("common.imageFigure.pinchToZoom")}</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-white/70 text-xs select-none bg-black/30 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          <Icon icon="mingcute:mouse-line" width={14} height={14} />
          <span>{t("common.imageFigure.wheelToZoom")}</span>
          <span className="mx-1">·</span>
          <KbdShortcut keys={["Esc"]} variant="lightbox" />
          <span>{t("common.imageFigure.close")}</span>
        </div>

        {exif && (
          <p className="text-white/70 text-xs md:text-sm tracking-wide select-none bg-black/30 px-2.5 md:px-3 py-1 rounded-lg backdrop-blur-sm text-center max-w-full overflow-hidden text-ellipsis">
            {exif.model && <span className="text-accent-300 font-semibold">{exif.model}</span>}
            {exif.model && (exif.focalLength || exif.fNumber || exif.exposureTime || exif.iso) && <span className="mx-1.5 md:mx-2">·</span>}
            {exif.focalLength && <span>{exif.focalLength}</span>}
            {exif.focalLength && (exif.fNumber || exif.exposureTime || exif.iso) && <span className="mx-1.5 md:mx-2">·</span>}
            {exif.fNumber && <span>{exif.fNumber}</span>}
            {exif.fNumber && (exif.exposureTime || exif.iso) && <span className="mx-1.5 md:mx-2">·</span>}
            {exif.exposureTime && <span>{exif.exposureTime}</span>}
            {exif.exposureTime && exif.iso && <span className="mx-1.5 md:mx-2">·</span>}
            {exif.iso && (
              <span>
                ISO
                {exif.iso}
              </span>
            )}
          </p>
        )}
        {alt && (
          <p className="text-white/70 text-xs md:text-sm tracking-wide select-none bg-black/30 px-2.5 md:px-3 py-1 rounded-lg backdrop-blur-sm text-center max-w-full overflow-hidden text-ellipsis">
            {alt}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
