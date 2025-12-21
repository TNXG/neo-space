"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTOCStore } from "@/lib/stores/toc-store";

interface ArticleTOCWrapperProps {
	children: ReactNode;
}

/**
 * TOC 智能定位包装器
 * - 正常滚动时：fixed 定位，固定在视口右侧
 * - 滚动超出文章区域时：隐藏 TOC（opacity: 0 + pointer-events: none）
 * - 使用 opacity 过渡避免布局抖动
 */
export function ArticleTOCWrapper({ children }: ArticleTOCWrapperProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const { setAutoScrollEnabled } = useTOCStore();
	const [isVisible, setIsVisible] = useState(true);
	const rafRef = useRef<number | null>(null);
	const prevAutoScrollRef = useRef(true);

	const checkPosition = useCallback(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper)
			return null;

		// 查找 data-toc-boundary 容器
		const boundary = wrapper.closest("[data-toc-boundary]");
		if (!boundary)
			return null;

		const boundaryRect = boundary.getBoundingClientRect();
		const wrapperHeight = wrapper.offsetHeight;
		const topOffset = 96; // top-24 = 6rem = 96px

		// 计算 TOC 底部相对于边界容器底部的位置
		const tocBottomInViewport = topOffset + wrapperHeight;
		const boundaryBottomInViewport = boundaryRect.bottom;

		// 使用缓冲区避免频繁切换
		const distance = boundaryBottomInViewport - tocBottomInViewport;

		return distance;
	}, []);

	useEffect(() => {
		const handleScroll = () => {
			// 使用 RAF 节流，避免频繁计算
			if (rafRef.current)
				return;

			rafRef.current = requestAnimationFrame(() => {
				rafRef.current = null;

				const distance = checkPosition();
				if (distance === null)
					return;

				// 使用缓冲区逻辑避免临界点闪烁
				setIsVisible((prevVisible) => {
					let shouldBeVisible: boolean;

					if (prevVisible) {
						// 当前可见，需要明显超出才隐藏
						shouldBeVisible = distance >= -100;
					} else {
						// 当前隐藏，需要明显回到范围内才显示
						shouldBeVisible = distance >= 100;
					}

					return shouldBeVisible;
				});
			});
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("resize", handleScroll, { passive: true });

		// 初始化检查
		handleScroll();

		return () => {
			window.removeEventListener("scroll", handleScroll);
			window.removeEventListener("resize", handleScroll);
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [checkPosition]);

	// 单独的 effect 处理 store 更新，避免渲染期间调用
	useEffect(() => {
		if (prevAutoScrollRef.current !== isVisible) {
			setAutoScrollEnabled(isVisible);
			prevAutoScrollRef.current = isVisible;
		}
	}, [isVisible, setAutoScrollEnabled]);

	return (
		<aside
			ref={wrapperRef}
			className="hidden xl:block w-56 fixed top-24 transition-opacity duration-300"
			style={{
				left: "calc(50% + 400px + 2rem)",
				opacity: isVisible ? 1 : 0,
				pointerEvents: isVisible ? "auto" : "none",
			}}
		>
			{children}
		</aside>
	);
}
