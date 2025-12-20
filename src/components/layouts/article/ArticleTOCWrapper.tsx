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
 * - 滚动超出文章区域时：切换为 absolute 定位，跟随页面滚动
 * - 添加缓冲区和防抖，避免频繁切换导致闪烁
 */
export function ArticleTOCWrapper({ children }: ArticleTOCWrapperProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const { setAutoScrollEnabled } = useTOCStore();
	const [isFixed, setIsFixed] = useState(true);
	const rafRef = useRef<number | null>(null);

	const checkPosition = useCallback(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper)
			return null;

		const parent = wrapper.parentElement;
		if (!parent)
			return null;

		const parentRect = parent.getBoundingClientRect();
		const wrapperHeight = wrapper.offsetHeight;
		const topOffset = 96; // top-24 = 6rem = 96px

		// 计算 TOC 底部相对于父容器底部的位置
		const tocBottomInViewport = topOffset + wrapperHeight;
		const parentBottomInViewport = parentRect.bottom;

		// 使用缓冲区避免频繁切换
		const distance = parentBottomInViewport - tocBottomInViewport;

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
				setIsFixed((prevFixed) => {
					let shouldBeFixed: boolean;

					if (prevFixed) {
						// 当前是 fixed，需要明显超出才切换为 absolute
						shouldBeFixed = distance >= -50;
					} else {
						// 当前是 absolute，需要明显回到范围内才切换为 fixed
						shouldBeFixed = distance >= 50;
					}

					// 只在状态改变时通知 store
					if (prevFixed !== shouldBeFixed) {
						setAutoScrollEnabled(shouldBeFixed);
					}

					return shouldBeFixed;
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
	}, [checkPosition, setAutoScrollEnabled]);

	return (
		<aside
			ref={wrapperRef}
			className={`hidden xl:block w-56 ${isFixed ? "fixed top-24" : "absolute bottom-16 right-0"}`}
			style={
				isFixed
					? { left: "calc(50% + 400px + 2rem)" }
					: undefined
			}
		>
			{children}
		</aside>
	);
}
