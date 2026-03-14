"use client";

import ExifReader from "exifreader";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KbdShortcut } from "@/components/ui/kbd";
import { Icon } from "@/lib/inline-icon";

// Static regex patterns to avoid re-compilation
const MM_REGEX = /mm/gi;

interface ImageFigureProps {
  src: string;
  alt?: string;
  className?: string;
  isBlock?: boolean;
}

interface ExifData {
  model?: string;
  focalLength?: string;
  fNumber?: string;
  iso?: string;
  exposureTime?: string;
  lens?: string;
}

/**
 * 按可信度排序读取元数据的辅助函数
 * ExifReader expanded 模式返回结构: { exif: {...}, xmp: {...}, iptc: {...}, icc: {...}, mpf: {...} }
 * 优先级：XMP → EXIF → IPTC → MPF
 */
function extractMetadataByPriority(tags: ExifReader.ExpandedTags): ExifData {
  const fieldPriorities = {
    model: ["xmp.Model", "exif.Model", "exif.Make", "iptc.Model"],
    focalLength: ["xmp.FocalLength", "exif.FocalLength", "exif.FocalLengthIn35mmFilm"],
    fNumber: ["xmp.FNumber", "exif.FNumber", "exif.ApertureValue"],
    iso: ["xmp.ISO", "exif.ISOSpeedRatings", "exif.ISO", "exif.PhotographicSensitivity"],
    exposureTime: ["xmp.ExposureTime", "exif.ExposureTime", "exif.ShutterSpeedValue"],
    lens: ["xmp.LensModel", "exif.LensModel", "exif.LensInfo", "exif.Lens"],
  };

  const getValueByPriority = (candidates: string[]): string | undefined => {
    for (const candidate of candidates) {
      const parts = candidate.split(".");
      let value: unknown = tags;

      for (const part of parts) {
        if (value && typeof value === "object" && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }

      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if ("description" in obj && obj.description) {
          const desc = String(obj.description).trim();
          if (desc && desc !== "undefined")
            return desc;
        }
        if ("value" in obj && obj.value !== undefined && obj.value !== null) {
          const val = String(obj.value).trim();
          if (val && val !== "undefined")
            return val;
        }
      }
    }
    return undefined;
  };

  const model = getValueByPriority(fieldPriorities.model);
  const focalLengthRaw = getValueByPriority(fieldPriorities.focalLength);
  const focalLength = focalLengthRaw ? `${focalLengthRaw.replace(MM_REGEX, "").trim()}mm` : undefined;
  const fNumber = getValueByPriority(fieldPriorities.fNumber);
  const iso = getValueByPriority(fieldPriorities.iso);
  const exposureTime = getValueByPriority(fieldPriorities.exposureTime);
  const lens = getValueByPriority(fieldPriorities.lens);

  return { model, focalLength, fNumber, iso, exposureTime, lens };
}

export function ImageFigure({ src, alt, className = "", isBlock = true }: ImageFigureProps) {
  const [isSmall, setIsSmall] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [exif, setExif] = useState<ExifData | null>(null);
  const mounted = typeof window !== "undefined";
  const imgRef = useRef<HTMLImageElement>(null);
  const hasCheckedCacheRef = useRef(false);

  const loadExifData = useCallback(async () => {
    if (isSmall || !src)
      return;

    try {
      const response = await fetch(src, {
        headers: { Range: "bytes=0-524288" },
      });
      const buffer = await response.arrayBuffer();
      const tags = ExifReader.load(buffer, { expanded: true });
      const data = extractMetadataByPriority(tags);

      if (data.model || data.iso || data.fNumber) {
        setExif(data);
      }
    } catch (error) {
      console.warn("Metadata parsing failed:", error);
    }
  }, [src, isSmall]);

  const handleImageComplete = useCallback(() => {
    setIsLoaded(true);
    setIsError(false);

    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      // 小图判断：只有真正的小图才跳过 EXIF
      if (naturalHeight < 64 || (naturalWidth < 150 && naturalHeight < 150)) {
        setIsSmall(true);
        return;
      }
    }

    if (typeof window.requestIdleCallback !== "undefined") {
      window.requestIdleCallback(() => {
        void loadExifData();
      });
    } else {
      setTimeout(() => {
        void loadExifData();
      }, 0);
    }
  }, [loadExifData]);

  useEffect(() => {
    if (!hasCheckedCacheRef.current && imgRef.current?.complete) {
      hasCheckedCacheRef.current = true;
      if (imgRef.current.naturalWidth === 0) {
        queueMicrotask(() => {
          setIsError(true);
          setIsLoaded(true);
        });
      } else {
        queueMicrotask(() => {
          handleImageComplete();
        });
      }
    }
  }, [handleImageComplete]);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsError(false);
    setIsLoaded(false);
    setRetryKey(prev => prev + 1);
  }, []);

  if (isSmall) {
    return (
      <span className={`inline-block align-middle relative group ${className}`}>
        <img
          key={retryKey}
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleImageComplete}
          onError={() => {
            setIsError(true);
            setIsLoaded(true);
          }}
          className={`rounded-md mx-1 max-w-full h-auto transition-opacity duration-300 ${
            isLoaded && !isError ? "opacity-100" : "opacity-0"
          }`}
          title={alt}
        />
        {isError && (
          <span
            className="absolute inset-0 flex items-center justify-center bg-primary-100 dark:bg-primary-800 rounded-md cursor-pointer text-primary-400 hover:text-primary-500 transition-colors"
            onClick={handleRetry}
            title="图片加载失败，点击重试"
          >
            <Icon icon="mingcute:close-circle-dash-line" width={16} height={16} />
          </span>
        )}
        {!isError && (
          <span
            className="absolute inset-0 cursor-pointer z-20"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(true);
            }}
          />
        )}
        {mounted && isOpen && !isError && (
          <LightboxPortal src={src} alt={alt} exif={null} onClose={() => setIsOpen(false)} />
        )}
      </span>
    );
  }

  const ContainerTag = isBlock ? "figure" : "span";
  const WrapperTag = isBlock ? "div" : "span";
  const wrapperClassExtra = isBlock ? "" : "inline-block align-middle";

  return (
    <>
      <ContainerTag
        className={`group relative flex flex-col items-center justify-center gap-3 ${className || "my-8"}`}
      >
        <WrapperTag
          className={`relative max-w-full overflow-hidden rounded-xl border border-primary-200 shadow-sm transition-all duration-300 ${wrapperClassExtra} ${
            isLoaded && !isError
              ? "bg-transparent w-fit"
              : isBlock
                ? `w-full sm:w-[80%] md:w-[70%] lg:w-150 aspect-video ${isError ? "bg-primary-100/50 dark:bg-primary-800/50" : "bg-primary-200/60 animate-pulse"}`
                : `w-24 sm:w-32 aspect-video ${isError ? "bg-primary-100/50 dark:bg-primary-800/50" : "bg-primary-200/60 animate-pulse"}`
          }`}
        >
          {!isError && (
            <img
              key={retryKey}
              ref={imgRef}
              src={src}
              alt={alt}
              onLoad={handleImageComplete}
              onError={() => {
                setIsError(true);
                setIsLoaded(true);
              }}
              className={`block h-auto w-auto max-w-full max-h-150 object-contain transition-opacity duration-500 ${
                isLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
            />
          )}
          {isError && (
            <span
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-primary-400/70 cursor-pointer hover:bg-primary-100/50 dark:hover:bg-primary-800/50 transition-colors"
              onClick={handleRetry}
              title="图片加载失败，点击重试"
            >
              <Icon icon="mingcute:close-circle-dash-line" className={isBlock ? "w-8 h-8 md:w-10 md:h-10" : "w-5 h-5"} />
              {isBlock && <span className="text-xs md:text-sm font-medium">重新加载</span>}
            </span>
          )}
          {!isError && (
            <span
              className="absolute inset-0 z-20 cursor-pointer block"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(true);
              }}
              title="点击放大"
            />
          )}
          {exif && !isError && (
            <span className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-mono bg-black/40 text-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none block animate-in fade-in duration-300">
              EXIF
            </span>
          )}
        </WrapperTag>
        {isBlock && alt && (
          <>
            <div className="w-12 md:w-16 h-px bg-primary-300/50" />
            <figcaption className="max-w-[95%] md:max-w-[90%] text-center text-xs md:text-sm text-primary-500 px-2">
              {alt}
            </figcaption>
          </>
        )}
      </ContainerTag>
      {mounted && isOpen && !isError && (
        <LightboxPortal src={src} alt={alt} exif={exif} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

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
        aria-label="Close"
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
        className="absolute bottom-8 md:bottom-12 left-0 right-0 flex flex-col items-center gap-2 md:gap-3 animate-in slide-in-from-bottom-4 duration-500 pointer-events-auto z-50 px-4"
        onClick={e => e.stopPropagation()}
      >
        {/* 缩放提示 - 移动端显示捏合，桌面端显示滚轮 */}
        <div className="flex md:hidden items-center gap-2 text-white/70 text-xs select-none bg-black/30 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          <Icon icon="mingcute:finger-tap-line" width={14} height={14} />
          <span>双指捏合缩放</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-white/70 text-xs select-none bg-black/30 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          <Icon icon="mingcute:mouse-line" width={14} height={14} />
          <span>滚轮缩放</span>
          <span className="mx-1">·</span>
          <KbdShortcut keys={["Esc"]} variant="lightbox" />
          <span>关闭</span>
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
