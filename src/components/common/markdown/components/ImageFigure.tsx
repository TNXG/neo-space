"use client";

import { Icon } from "@iconify/react";
import ExifReader from "exifreader";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
	const focalLength = focalLengthRaw ? `${focalLengthRaw.replace(/mm/gi, "").trim()}mm` : undefined;
	const fNumber = getValueByPriority(fieldPriorities.fNumber);
	const iso = getValueByPriority(fieldPriorities.iso);
	const exposureTime = getValueByPriority(fieldPriorities.exposureTime);
	const lens = getValueByPriority(fieldPriorities.lens);

	return { model, focalLength, fNumber, iso, exposureTime, lens };
}

export function ImageFigure({ src, alt, className = "", isBlock = true }: ImageFigureProps) {
	const [isSmall, setIsSmall] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [exif, setExif] = useState<ExifData | null>(null);
	const mounted = typeof window !== "undefined";
	const imgRef = useRef<HTMLImageElement>(null);
	const hasCheckedCache = useRef(false);

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
		if (!hasCheckedCache.current && imgRef.current?.complete) {
			hasCheckedCache.current = true;
			queueMicrotask(() => {
				handleImageComplete();
			});
		}
	}, [handleImageComplete]);

	if (isSmall) {
		return (
			<span className={`inline-block align-middle relative group ${className}`}>
				<img
					ref={imgRef}
					src={src}
					alt={alt}
					onLoad={handleImageComplete}
					className={`rounded-md mx-1 max-w-full h-auto transition-opacity duration-300 ${
						isLoaded ? "opacity-100" : "opacity-0"
					}`}
					title={alt}
				/>
				<span
					className="absolute inset-0 cursor-pointer z-20"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						setIsOpen(true);
					}}
				/>
				{mounted && isOpen && (
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
				className={`group relative flex flex-col items-center justify-center gap-3 transition-opacity duration-500 ${
					isLoaded ? "opacity-100" : "opacity-0"
				} ${className || "my-8"}`}
			>
				<WrapperTag
					className={`relative w-fit max-w-full overflow-hidden rounded-xl border border-primary-200 bg-transparent shadow-sm transition-all duration-300 hover:shadow-md hover:border-accent-300/50 dark:border-primary-800 ${wrapperClassExtra}`}
				>
					<img
						ref={imgRef}
						src={src}
						alt={alt}
						onLoad={handleImageComplete}
						onError={() => setIsLoaded(true)}
						className="block h-auto w-auto max-w-full max-h-150 object-contain"
						loading="lazy"
					/>
					<span
						className="absolute inset-0 z-20 cursor-pointer block"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setIsOpen(true);
						}}
						title="点击放大"
					/>
					{exif && (
						<span className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none block animate-in fade-in duration-300">
							EXIF
						</span>
					)}
				</WrapperTag>
				{isBlock && alt && (
					<figcaption className="max-w-[90%] text-center text-sm text-primary-500 dark:text-primary-400">
						{alt}
					</figcaption>
				)}
			</ContainerTag>
			{mounted && isOpen && (
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

	const dragStart = useRef({ x: 0, y: 0 });
	const imgRef = useRef<HTMLImageElement>(null);
	const lastClickTime = useRef(0);
	const touchStartDistance = useRef(0);
	const touchStartScale = useRef(1);
	const touchStartPos = useRef({ x: 0, y: 0 });

	useEffect(() => {
		document.body.style.overflow = "hidden";
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape")
				onClose();
		};
		window.addEventListener("keydown", handleEsc);
		return () => {
			document.body.style.overflow = "";
			window.removeEventListener("keydown", handleEsc);
		};
	}, [onClose]);

	const handleWheel = useCallback((e: React.WheelEvent) => {
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
		const timeSinceLastClick = now - lastClickTime.current;

		// 快速双击（250ms内）关闭灯箱
		if (timeSinceLastClick < 250) {
			onClose();
			return;
		}

		lastClickTime.current = now;

		// 单击切换缩放
		setScale((prev) => {
			if (prev > 1) {
				setPosition({ x: 0, y: 0 });
				return 1;
			}
			return 2;
		});
	}, [hasDragged, onClose]);

	const handleMouseDown = (e: React.MouseEvent) => {
		if (scale > 1) {
			setIsDragging(true);
			setHasDragged(false);
			dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
			e.preventDefault();
			e.stopPropagation();
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging && scale > 1) {
			const deltaX = Math.abs(e.clientX - dragStart.current.x - position.x);
			const deltaY = Math.abs(e.clientY - dragStart.current.y - position.y);

			// 移动超过5px才算拖拽
			if (deltaX > 5 || deltaY > 5) {
				setHasDragged(true);
			}

			setPosition({
				x: e.clientX - dragStart.current.x,
				y: e.clientY - dragStart.current.y,
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
			touchStartDistance.current = getTouchDistance(e.touches);
			touchStartScale.current = scale;
			touchStartPos.current = position;
		} else if (e.touches.length === 1 && scale > 1) {
			// 单指拖拽（仅在放大时）
			setIsDragging(true);
			setHasDragged(false);
			const touch = e.touches[0];
			dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
		}
	};

	// 触摸移动
	const handleTouchMove = (e: React.TouchEvent) => {
		if (e.touches.length === 2) {
			// 双指捏合缩放
			e.preventDefault();
			const currentDistance = getTouchDistance(e.touches);
			const scaleChange = currentDistance / touchStartDistance.current;
			const newScale = Math.max(1, Math.min(touchStartScale.current * scaleChange, 5));

			setScale(newScale);

			if (newScale <= 1) {
				setPosition({ x: 0, y: 0 });
			}
		} else if (e.touches.length === 1 && isDragging && scale > 1) {
			// 单指拖拽
			e.preventDefault();
			const touch = e.touches[0];
			const deltaX = Math.abs(touch.clientX - dragStart.current.x - position.x);
			const deltaY = Math.abs(touch.clientY - dragStart.current.y - position.y);

			if (deltaX > 5 || deltaY > 5) {
				setHasDragged(true);
			}

			setPosition({
				x: touch.clientX - dragStart.current.x,
				y: touch.clientY - dragStart.current.y,
			});
		}
	};

	// 触摸结束
	const handleTouchEnd = (e: React.TouchEvent) => {
		if (e.touches.length === 0) {
			setIsDragging(false);
			touchStartDistance.current = 0;
		}
	};

	return createPortal(
		<div
			className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
			onClick={onClose}
			onWheel={handleWheel}
		>
			<button
				type="button"
				className="absolute top-5 right-5 p-2 rounded-full bg-black/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors z-50 cursor-pointer"
				onClick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				aria-label="Close"
			>
				<Icon icon="mingcute:close-line" width={24} height={24} />
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
				className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-3 animate-in slide-in-from-bottom-4 duration-500 pointer-events-auto z-50"
				onClick={e => e.stopPropagation()}
			>
				{exif && (
					<p className="text-white/70 text-sm font-light tracking-wide select-none bg-black/30 px-3 py-1 rounded-lg backdrop-blur-sm">
						{exif.model && <span className="text-accent-300 font-semibold">{exif.model}</span>}
						{exif.model && (exif.focalLength || exif.fNumber || exif.exposureTime || exif.iso) && <span className="mx-2">·</span>}
						{exif.focalLength && <span>{exif.focalLength}</span>}
						{exif.focalLength && (exif.fNumber || exif.exposureTime || exif.iso) && <span className="mx-2">·</span>}
						{exif.fNumber && <span>{exif.fNumber}</span>}
						{exif.fNumber && (exif.exposureTime || exif.iso) && <span className="mx-2">·</span>}
						{exif.exposureTime && <span>{exif.exposureTime}</span>}
						{exif.exposureTime && exif.iso && <span className="mx-2">·</span>}
						{exif.iso && (
							<span>
								ISO
								{exif.iso}
							</span>
						)}
					</p>
				)}
				{alt && (
					<p className="text-white/70 text-sm font-light tracking-wide select-none bg-black/30 px-3 py-1 rounded-lg backdrop-blur-sm">
						{alt}
					</p>
				)}
			</div>
		</div>,
		document.body,
	);
}
