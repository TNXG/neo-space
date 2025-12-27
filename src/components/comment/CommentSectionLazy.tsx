"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// 懒加载整个客户端评论组件
const CommentSection = dynamic(
	() => import("./CommentSection").then(mod => mod.CommentSection),
	{ ssr: false },
);

interface CommentSectionLazyProps {
	refId: string;
	refType: "posts" | "pages" | "notes";
	initialComments: Comment[];
	initialCount: number;
}

/**
 * 客户端懒加载包装组件
 * 基于 IntersectionObserver 实现视口懒加载
 */
export function CommentSectionLazy({
	refId,
	refType,
	initialComments,
	initialCount,
}: CommentSectionLazyProps) {
	const [isVisible, setIsVisible] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container)
			return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{
				rootMargin: "200px",
				threshold: 0,
			},
		);

		observer.observe(container);

		return () => observer.disconnect();
	}, []);

	// 组件加载完成后标记
	useEffect(() => {
		if (isVisible) {
			// 给一点延迟确保组件渲染完成
			const timer = setTimeout(() => setIsLoaded(true), 100);
			return () => clearTimeout(timer);
		}
	}, [isVisible]);

	return (
		<div ref={containerRef} className="min-h-[100px]">
			{isVisible
				? (
						<>
							{!isLoaded && (
								<div className="flex items-center justify-center py-8">
									<Icon icon="mingcute:loading-line" className="w-6 h-6 animate-spin text-accent-500" />
								</div>
							)}
							<div className={isLoaded ? "opacity-100" : "opacity-0"}>
								<CommentSection
									refId={refId}
									refType={refType}
									initialComments={initialComments}
									initialCount={initialCount}
								/>
							</div>
						</>
					)
				: (
						<div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
							加载评论区...
						</div>
					)}
		</div>
	);
}
