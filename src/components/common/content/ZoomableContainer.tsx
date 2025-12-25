"use client";

import { Icon } from "@iconify/react/offline";
import { useCallback, useEffect, useRef, useState } from "react";
import { KbdShortcut } from "@/components/ui/kbd";
import { useIsMobile } from "@/hook/use-is-mobile";
import { cn } from "@/lib/utils";

interface ZoomableContainerProps {
	/** 子元素 */
	children: React.ReactNode;
	/** 自定义 className */
	className?: string;
	/** 最小缩放比例 */
	minZoom?: number;
	/** 最大缩放比例 */
	maxZoom?: number;
	/** 初始缩放比例 */
	initialZoom?: number;
}

/**
 * 可缩放容器组件
 * 支持桌面端鼠标滚轮缩放和移动端手指捏合缩放
 */
export function ZoomableContainer({
	children,
	className = "",
	minZoom = 0.5,
	maxZoom = 3,
	initialZoom = 1,
}: ZoomableContainerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const scaleRef = useRef(initialZoom);
	const positionRef = useRef({ x: 0, y: 0 });
	const [scale, setScaleState] = useState(initialZoom);

	// 同步更新 scale 和 scaleRef
	const setScale = useCallback((newScale: number) => {
		scaleRef.current = newScale;
		setScaleState(newScale);
	}, []);

	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [isAtBoundary, setIsAtBoundary] = useState(false);
	const [showHint, setShowHint] = useState(false);
	const boundaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const hideHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isMobile = useIsMobile();

	// 边界防抖效果
	const triggerBoundaryEffect = useCallback(() => {
		setIsAtBoundary(true);
		if (boundaryTimeoutRef.current) {
			clearTimeout(boundaryTimeoutRef.current);
		}
		boundaryTimeoutRef.current = setTimeout(() => {
			setIsAtBoundary(false);
		}, 200);
	}, []);

	// 移动端首次显示提示
	useEffect(() => {
		if (isMobile && !showHint) {
			hintTimeoutRef.current = setTimeout(() => {
				setShowHint(true);
				// 3秒后自动隐藏
				hideHintTimeoutRef.current = setTimeout(() => setShowHint(false), 3000);
			}, 500);
		}
		return () => {
			if (hintTimeoutRef.current) {
				clearTimeout(hintTimeoutRef.current);
			}
			if (hideHintTimeoutRef.current) {
				clearTimeout(hideHintTimeoutRef.current);
			}
		};
	}, [isMobile, showHint]);

	// 处理鼠标滚轮缩放（更平滑）
	useEffect(() => {
		const container = containerRef.current;
		if (!container)
			return;

		const handleWheel = (e: WheelEvent) => {
			// 检查是否按住 Ctrl/Cmd 键或使用触控板捏合手势
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();

				const delta = -e.deltaY;
				// 更平滑的缩放因子（从 0.1 改为 0.001）
				const zoomFactor = 1 + (delta * 0.001);
				const newScale = scale * zoomFactor;

				// 检查是否到达边界
				if (newScale <= minZoom) {
					setScale(minZoom);
					triggerBoundaryEffect();
				} else if (newScale >= maxZoom) {
					setScale(maxZoom);
					triggerBoundaryEffect();
				} else {
					setScale(newScale);
				}
			}
		};

		container.addEventListener("wheel", handleWheel, { passive: false });
		return () => {
			container.removeEventListener("wheel", handleWheel);
			if (boundaryTimeoutRef.current) {
				clearTimeout(boundaryTimeoutRef.current);
			}
		};
	}, [scale, minZoom, maxZoom, triggerBoundaryEffect, setScale]);

	// 处理触摸缩放和拖拽
	useEffect(() => {
		const container = containerRef.current;
		if (!container)
			return;

		let initialDistance = 0;
		let initialScale = 1;
		let isPinching = false;
		let isTouchDragging = false;
		let touchDragStart = { x: 0, y: 0 };
		let lastPosition = { x: 0, y: 0 };

		const getDistance = (touches: TouchList) => {
			const dx = touches[0].clientX - touches[1].clientX;
			const dy = touches[0].clientY - touches[1].clientY;
			return Math.sqrt(dx * dx + dy * dy);
		};

		const handleTouchStart = (e: TouchEvent) => {
			if (e.touches.length === 2) {
				// 双指：开始缩放
				e.preventDefault();
				initialDistance = getDistance(e.touches);
				initialScale = scaleRef.current;
				isPinching = true;
				isTouchDragging = false;
			} else if (e.touches.length === 1 && scaleRef.current > 1) {
				// 单指且已放大：开始拖拽
				e.preventDefault();
				const touch = e.touches[0];
				touchDragStart = { x: touch.clientX, y: touch.clientY };
				lastPosition = positionRef.current;
				isTouchDragging = true;
				setIsDragging(true);
			}
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length === 2 && isPinching) {
				// 双指缩放
				e.preventDefault();
				const currentDistance = getDistance(e.touches);
				const scaleChange = currentDistance / initialDistance;

				const dampingFactor = 0.5;
				const adjustedScaleChange = 1 + (scaleChange - 1) * dampingFactor;
				const newScale = initialScale * adjustedScaleChange;

				if (newScale <= minZoom) {
					setScale(minZoom);
					triggerBoundaryEffect();
				} else if (newScale >= maxZoom) {
					setScale(maxZoom);
					triggerBoundaryEffect();
				} else {
					setScale(newScale);
				}
			} else if (e.touches.length === 1 && isTouchDragging && scaleRef.current > 1) {
				// 单指拖拽
				e.preventDefault();
				const touch = e.touches[0];
				const deltaX = touch.clientX - touchDragStart.x;
				const deltaY = touch.clientY - touchDragStart.y;
				const newPosition = {
					x: lastPosition.x + deltaX,
					y: lastPosition.y + deltaY,
				};
				setPosition(newPosition);
				positionRef.current = newPosition;
			}
		};

		const handleTouchEnd = () => {
			isPinching = false;
			isTouchDragging = false;
			setIsDragging(false);
		};

		container.addEventListener("touchstart", handleTouchStart, { passive: false });
		container.addEventListener("touchmove", handleTouchMove, { passive: false });
		container.addEventListener("touchend", handleTouchEnd);

		return () => {
			container.removeEventListener("touchstart", handleTouchStart);
			container.removeEventListener("touchmove", handleTouchMove);
			container.removeEventListener("touchend", handleTouchEnd);
		};
	}, [minZoom, maxZoom, triggerBoundaryEffect, setScale]);

	// 处理拖拽
	const handleMouseDown = (e: React.MouseEvent) => {
		if (scale > 1) {
			setIsDragging(true);
			setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging) {
			const newPosition = {
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y,
			};
			setPosition(newPosition);
			positionRef.current = newPosition;
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
	};

	// 重置缩放和位置
	const handleReset = () => {
		setScale(initialZoom);
		setPosition({ x: 0, y: 0 });
		positionRef.current = { x: 0, y: 0 };
	};

	// 只重置位置
	const handleResetPosition = () => {
		setPosition({ x: 0, y: 0 });
		positionRef.current = { x: 0, y: 0 };
	};

	return (
		<div className={cn("relative group", className)}>
			{/* 控制按钮 */}
			<div className={cn(
				"absolute top-2 right-2 z-10 flex gap-2 transition-opacity",
				isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
			)}
			>
				<button
					type="button"
					onClick={() => {
						const newScale = Math.min(maxZoom, scale * 1.2);
						if (newScale >= maxZoom) {
							triggerBoundaryEffect();
						}
						setScale(newScale);
					}}
					disabled={scale >= maxZoom}
					className={cn(
						"w-8 h-8 rounded-lg bg-bg-glass backdrop-blur-sm border border-primary-200 hover:bg-primary-100 transition-all flex items-center justify-center cursor-pointer",
						scale >= maxZoom && "opacity-50 cursor-not-allowed",
						isAtBoundary && scale >= maxZoom && "animate-bounce",
					)}
					title="放大"
					aria-label="放大"
				>
					<Icon icon="mingcute:zoom-in-line" width={18} height={18} />
				</button>
				<button
					type="button"
					onClick={() => {
						const newScale = Math.max(minZoom, scale / 1.2);
						if (newScale <= minZoom) {
							triggerBoundaryEffect();
						}
						setScale(newScale);
					}}
					disabled={scale <= minZoom}
					className={cn(
						"w-8 h-8 rounded-lg bg-bg-glass backdrop-blur-sm border border-primary-200 hover:bg-primary-100 transition-all flex items-center justify-center cursor-pointer",
						scale <= minZoom && "opacity-50 cursor-not-allowed",
						isAtBoundary && scale <= minZoom && "animate-bounce",
					)}
					title="缩小"
					aria-label="缩小"
				>
					<Icon icon="mingcute:zoom-out-line" width={18} height={18} />
				</button>
				{scale !== initialZoom && (
					<button
						type="button"
						onClick={handleReset}
						className="w-8 h-8 rounded-lg bg-bg-glass backdrop-blur-sm border border-primary-200 hover:bg-primary-100 transition-all flex items-center justify-center cursor-pointer animate-in fade-in duration-200"
						title="恢复原始大小"
						aria-label="恢复原始大小"
					>
						<Icon icon="mingcute:fullscreen-exit-line" width={18} height={18} />
					</button>
				)}
				{(position.x !== 0 || position.y !== 0) && (
					<button
						type="button"
						onClick={handleResetPosition}
						className="w-8 h-8 rounded-lg bg-bg-glass backdrop-blur-sm border border-primary-200 hover:bg-primary-100 transition-all flex items-center justify-center cursor-pointer animate-in fade-in duration-200"
						title="重置位置"
						aria-label="重置位置"
					>
						<Icon icon="mingcute:refresh-2-line" width={18} height={18} />
					</button>
				)}
			</div>

			{/* 缩放提示 */}
			{scale !== initialZoom && (
				<div
					className={cn(
						"absolute bottom-2 right-2 z-10 px-3 py-1 rounded-full bg-bg-glass backdrop-blur-sm border border-primary-200 text-xs text-text-primary transition-all",
						isAtBoundary && "scale-110 border-accent-300",
					)}
				>
					{Math.round(scale * 100)}
					%
				</div>
			)}

			{/* 可缩放内容容器 */}
			<div
				ref={containerRef}
				className="overflow-hidden select-none"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				style={{
					cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
					// 只在放大状态下禁用触摸操作，允许正常滚动
					touchAction: scale > 1 ? "none" : "pan-y",
				}}
			>
				<div
					ref={contentRef}
					className="origin-center"
					style={{
						transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
						transformOrigin: "center",
						transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
					}}
				>
					{children}
				</div>
			</div>

			{/* 使用提示 */}
			{!isMobile && (
				<div className="mt-2 text-xs text-muted-foreground/60 text-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
					<span>缩放：</span>
					<KbdShortcut keys={["Ctrl", "滚轮"]} />
					{scale > 1 && (
						<>
							<span className="mx-1">•</span>
							<span>拖拽移动</span>
						</>
					)}
				</div>
			)}

			{/* 移动端提示 */}
			{isMobile && showHint && (
				<div className="mt-2 text-xs text-muted-foreground/80 text-center animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center justify-center gap-2 bg-bg-glass backdrop-blur-sm px-3 py-2 rounded-lg border border-primary-200 mx-auto w-fit">
					<Icon icon="mingcute:finger-tap-line" width={16} height={16} />
					<span>双指捏合缩放</span>
					{scale > 1 && <span>• 拖拽移动</span>}
				</div>
			)}
		</div>
	);
}
