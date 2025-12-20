"use client";

import type { ReactNode } from "react";
import type { TOCItem } from "@/lib/toc";
import { useCallback, useEffect, useRef } from "react";
import { useTOCStore } from "@/lib/stores/toc-store";

interface ArticleContentProps {
	children: ReactNode;
	items: TOCItem[];
}

/**
 * 文章内容包装器
 * 负责初始化 TOC store 和设置 Intersection Observer
 * 滚动方向感知：页面下滑时标题进入底部 30% 更新，页面上滑时标题进入顶部 30% 更新
 */
export function ArticleContent({ children, items }: ArticleContentProps) {
	const { setItems, setActiveId } = useTOCStore();
	const contentRef = useRef<HTMLDivElement>(null);
	const lastScrollY = useRef(0);
	const scrollDirection = useRef<"down" | "up">("down");
	const lastActiveId = useRef<string>("");
	const rafId = useRef<number | null>(null);

	// 初始化 items
	useEffect(() => {
		setItems(items);
	}, [items, setItems]);

	// 防抖的 setActiveId，避免快速滚动时抖动
	const debouncedSetActiveId = useCallback((id: string) => {
		if (id === lastActiveId.current)
			return;
		lastActiveId.current = id;
		setActiveId(id);
	}, [setActiveId]);

	// 追踪滚动方向
	useEffect(() => {
		const handleScroll = () => {
			const currentY = window.scrollY;
			scrollDirection.current = currentY > lastScrollY.current ? "down" : "up";
			lastScrollY.current = currentY;
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// 设置滚动监听检测标题位置
	useEffect(() => {
		if (items.length === 0)
			return;

		let scrollHandler: (() => void) | null = null;

		const timer = setTimeout(() => {
			const container = contentRef.current;
			if (!container)
				return;

			// 获取所有标题元素
			const headings = Array.from(container.querySelectorAll("h1[id], h2[id], h3[id], h4[id]"))
				.filter(h => h.id);

			if (headings.length === 0)
				return;

			// 使用 scroll 事件来检测标题位置，通过 RAF 节流
			scrollHandler = () => {
				if (rafId.current)
					return;

				rafId.current = requestAnimationFrame(() => {
					rafId.current = null;

					const viewportHeight = window.innerHeight;
					// 30% 触发线：页面下滑时用底部 30%，页面上滑时用顶部 30%
					const triggerLine = scrollDirection.current === "down"
						? viewportHeight * 0.7
						: viewportHeight * 0.3;

					let activeHeading: Element | null = null;

					// 找最后一个已经越过触发线的标题
					for (const heading of headings) {
						const rect = heading.getBoundingClientRect();
						if (rect.top <= triggerLine) {
							activeHeading = heading;
						}
					}

					// 如果没有找到激活的标题，但最后一个标题已经在视口上方
					// 则保持最后一个标题为激活状态（防止滚动到底部时闪烁）
					if (!activeHeading && headings.length > 0) {
						const lastHeading = headings[headings.length - 1];
						const lastRect = lastHeading.getBoundingClientRect();
						if (lastRect.top < 0) {
							activeHeading = lastHeading;
						}
					}

					if (activeHeading && activeHeading.id) {
						debouncedSetActiveId(activeHeading.id);
					}
				});
			};

			// 初始化
			scrollHandler();

			// 监听滚动
			window.addEventListener("scroll", scrollHandler, { passive: true });
		}, 300);

		return () => {
			clearTimeout(timer);
			if (rafId.current) {
				cancelAnimationFrame(rafId.current);
			}
			if (scrollHandler) {
				window.removeEventListener("scroll", scrollHandler);
			}
		};
	}, [items, debouncedSetActiveId]);

	return <div ref={contentRef}>{children}</div>;
}
