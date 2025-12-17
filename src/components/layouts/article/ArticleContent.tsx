"use client";

import type { ReactNode } from "react";
import type { TOCItem } from "@/lib/toc";
import { useEffect, useRef } from "react";
import { useTOCStore } from "@/lib/stores/toc-store";

interface ArticleContentProps {
	children: ReactNode;
	items: TOCItem[];
}

/**
 * 文章内容包装器
 * 负责初始化 TOC store 和设置 Intersection Observer
 */
export function ArticleContent({ children, items }: ArticleContentProps) {
	const { setItems, setActiveId } = useTOCStore();
	const contentRef = useRef<HTMLDivElement>(null);
	const observerRef = useRef<IntersectionObserver | null>(null);

	// 初始化 items
	useEffect(() => {
		setItems(items);
	}, [items, setItems]);

	// 设置 Intersection Observer
	useEffect(() => {
		if (items.length === 0)
			return;

		const timer = setTimeout(() => {
			const container = contentRef.current;
			if (!container)
				return;

			// 清理旧的 observer
			if (observerRef.current)
				observerRef.current.disconnect();

			// 创建新的 observer
			observerRef.current = new IntersectionObserver(
				(entries) => {
					const intersecting = entries.filter(e => e.isIntersecting);
					if (intersecting.length > 0) {
						// 选择最接近屏幕中心的标题
						const sorted = intersecting.sort((a, b) => {
							const aDist = Math.abs(a.boundingClientRect.top - window.innerHeight / 2);
							const bDist = Math.abs(b.boundingClientRect.top - window.innerHeight / 2);
							return aDist - bDist;
						});
						setActiveId(sorted[0].target.id);
					}
				},
				{
					root: null,
					rootMargin: "-45% 0px -45% 0px",
					threshold: 0,
				},
			);

			// 观察所有标题
			const headings = container.querySelectorAll("h1[id], h2[id], h3[id], h4[id]");
			headings.forEach((heading) => {
				if (heading.id)
					observerRef.current?.observe(heading);
			});
		}, 300);

		return () => {
			clearTimeout(timer);
			observerRef.current?.disconnect();
		};
	}, [items, setActiveId]);

	return <div ref={contentRef}>{children}</div>;
}
