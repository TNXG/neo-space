"use client";

import type { Note, Post } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { stripMarkdown, truncateText } from "@/components/common/markdown/utils";
import { SmartDate } from "@/components/common/smart-date";
import { useIsMobile } from "@/hook/use-is-mobile";
import { cn } from "@/lib/utils";

type Item = Post | Note;

interface InteractiveListProps<T extends Item> {
	items: T[];
	pagination: {
		currentPage: number;
		totalPages: number;
	};
	type: "post" | "note";
	emptyMessage?: string;
}

/**
 * 通用交互式列表组件
 * 支持 Post 和 Note 两种类型
 */
export function InteractiveList<T extends Item>({
	items,
	pagination,
	type,
	emptyMessage = "选择一项查看详情",
}: InteractiveListProps<T>) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const isMobile = useIsMobile();

	// 初始化时尝试选中第一个，移动端不选中
	const [selectedId, setSelectedId] = useState<string | null>(
		!isMobile && items.length > 0 ? items[0]._id : null,
	);

	// 用于追踪指示条位置
	const listRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
	const indicatorRef = useRef<HTMLDivElement>(null);

	const router = useRouter();
	const searchParams = useSearchParams();

	// 移动端不显示预览，activeItem 为 null
	const activeItem = isMobile
		? null
		: hoveredId
			? items.find(item => item._id === hoveredId)
			: (selectedId && items.find(item => item._id === selectedId)) // 检查 selectedId 是否在当前列表中
					? items.find(item => item._id === selectedId)
					: items[0]; // 如果没选中或选中项不在当前页（翻页了），默认使用第一项

	// 当 activeItem 变化时，直接更新 DOM（不触发 re-render）
	useLayoutEffect(() => {
		if (!indicatorRef.current || !listRef.current)
			return;

		if (!activeItem) {
			indicatorRef.current.style.opacity = "0";
			return;
		}

		const itemEl = itemRefs.current.get(activeItem._id);
		if (!itemEl) {
			indicatorRef.current.style.opacity = "0";
			return;
		}

		const listRect = listRef.current.getBoundingClientRect();
		const itemRect = itemEl.getBoundingClientRect();

		// 直接操作 DOM，motion 会自动处理动画
		indicatorRef.current.style.setProperty("--indicator-top", `${itemRect.top - listRect.top}px`);
		indicatorRef.current.style.setProperty("--indicator-height", `${itemRect.height}px`);
		indicatorRef.current.style.opacity = "1";
	}, [activeItem]);

	const handlePageChange = (page: number) => {
		const params = new URLSearchParams(searchParams);
		params.set("page", page.toString());
		router.push(`?${params.toString()}`);
		// 翻页时清理 hover 状态，防止残留
		setHoveredId(null);
	};

	const handleMouseEnter = (id: string) => {
		// 移动端不处理 hover
		if (isMobile)
			return;
		setHoveredId(id);
		setSelectedId(id);
	};

	// 生成 URL
	const getItemUrl = (item: T): string => {
		if (type === "post") {
			const post = item as Post;
			const categorySlug = post.category?.slug || "default";
			return `/posts/${categorySlug}/${post.slug}`;
		}
		const note = item as Note;
		return `/notes/${note.nid}`;
	};

	// 渲染左侧预览面板
	const renderPreview = () => {
		if (!activeItem) {
			return (
				<div className="h-40 flex items-center justify-start text-muted-foreground opacity-50">
					<span className="flex items-center gap-2">
						<Icon icon="mingcute:arrow-left-line" />
						{emptyMessage}
					</span>
				</div>
			);
		}

		if (type === "post") {
			const post = activeItem as Post;
			return (
				<motion.div
					key={post._id}
					initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
					animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
					exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
					transition={{ duration: 0.35, ease: "easeOut" }}
					className="space-y-6"
				>
					{/* Dates */}
					<div className="flex flex-col items-start gap-1 text-sm font-mono text-muted-foreground">
						<div className="flex items-center gap-2" title="发布时间">
							<Icon icon="mingcute:calendar-2-line" className="w-4 h-4" />
							<span>
								{new Date(post.created).toLocaleString("zh-CN", {
									year: "numeric",
									month: "2-digit",
									day: "2-digit",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</div>
						{post.modified && (
							<div className="flex items-center gap-2 text-xs opacity-70" title="修改时间">
								<Icon icon="mingcute:edit-2-line" className="w-3.5 h-3.5" />
								<span>
									{new Date(post.modified).toLocaleString("zh-CN", {
										year: "numeric",
										month: "2-digit",
										day: "2-digit",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
						)}
					</div>

					{/* Title */}
					<h2 className="text-3xl font-bold leading-tight text-foreground">
						{post.title}
					</h2>

					{/* Category */}
					{post.category && (
						<div className="flex justify-start">
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300">
								<Icon icon="mingcute:folder-open-line" />
								{post.category.name}
							</span>
						</div>
					)}

					{/* Summary */}
					<div className="text-primary-600 dark:text-primary-400 text-sm leading-7">
						{post.aiSummary && !post.summary && (
							<div className="flex items-center gap-1.5 mb-2">
								<Icon icon="mingcute:sparkles-line" className="w-3.5 h-3.5 text-accent-500" />
								<span className="text-xs font-medium text-accent-600 dark:text-accent-400">
									AI 摘要
								</span>
							</div>
						)}
						<p className="text-left line-clamp-6">
							{post.summary || post.aiSummary
								? truncateText(stripMarkdown(post.summary || post.aiSummary || ""), 300)
								: "暂无简介，请点击阅读详情..."}
						</p>
					</div>

					{/* Tags */}
					{post.tags && post.tags.length > 0 && (
						<div className="flex flex-wrap justify-start gap-2 pt-2">
							{post.tags.map(tag => (
								<span key={tag} className="flex items-center gap-1 text-xs text-accent-600 bg-accent-50 dark:bg-accent-950/40 px-2 py-1 rounded-md border border-accent-100 dark:border-accent-900/50">
									<Icon icon="mingcute:tag-line" />
									{tag}
								</span>
							))}
						</div>
					)}
				</motion.div>
			);
		}

		// Note preview
		const note = activeItem as Note;
		return (
			<motion.div
				key={note._id}
				initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
				animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
				exit={{ opacity: 0, x: 10, filter: "blur(4px)" }}
				transition={{ duration: 0.35, ease: "easeOut" }}
				className="space-y-6"
			>
				{/* Dates */}
				<div className="flex flex-col items-start gap-1 text-sm font-mono text-muted-foreground">
					<div className="flex items-center gap-2" title="发布时间">
						<Icon icon="mingcute:calendar-2-line" className="w-4 h-4" />
						<span>
							{new Date(note.created).toLocaleString("zh-CN", {
								year: "numeric",
								month: "2-digit",
								day: "2-digit",
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					</div>
					{note.modified && (
						<div className="flex items-center gap-2 text-xs opacity-70" title="修改时间">
							<Icon icon="mingcute:edit-2-line" className="w-3.5 h-3.5" />
							<span>
								{new Date(note.modified).toLocaleString("zh-CN", {
									year: "numeric",
									month: "2-digit",
									day: "2-digit",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</div>
					)}
				</div>

				{/* Title */}
				<h2 className="text-3xl font-bold leading-tight text-foreground">
					{note.title}
				</h2>

				{/* Mood & Weather & Location */}
				<div className="flex flex-wrap justify-start gap-2">
					{note.mood && (
						<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-pink-100 dark:bg-pink-800 text-pink-700 dark:text-pink-300">
							<Icon icon="mingcute:emoji-line" />
							{note.mood}
						</span>
					)}
					{note.weather && (
						<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
							<Icon icon="mingcute:cloud-line" />
							{note.weather}
						</span>
					)}
					{note.location && (
						<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">
							<Icon icon="mingcute:location-line" />
							{note.location}
						</span>
					)}
				</div>

				{/* Text Preview */}
				<div className="text-primary-600 dark:text-primary-400 text-sm leading-7">
					{note.aiSummary && (
						<div className="flex items-center gap-1.5 mb-2">
							<Icon icon="mingcute:sparkles-line" className="w-3.5 h-3.5 text-accent-500" />
							<span className="text-xs font-medium text-accent-600 dark:text-accent-400">
								AI 摘要
							</span>
						</div>
					)}
					<p className="text-left line-clamp-6">
						{note.aiSummary
							? truncateText(stripMarkdown(note.aiSummary), 200)
							: truncateText(stripMarkdown(note.text), 200)}
					</p>
				</div>
			</motion.div>
		);
	};

	return (
		<div className="max-w-5xl mx-auto">
			<div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] gap-6 md:gap-8 relative items-start">
				{/* Left Panel - Preview (Desktop Only) */}
				<aside className="hidden lg:block sticky top-24 h-fit pr-4">
					<AnimatePresence mode="wait">
						{renderPreview()}
					</AnimatePresence>
				</aside>

				{/* Right Panel - List */}
				<div className="flex flex-col gap-4 md:gap-6">
					<div
						ref={listRef}
						className="space-y-0 lg:space-y-1 lg:border-l lg:border-border/50 relative min-h-[400px] md:min-h-[500px]"
						onMouseLeave={() => setHoveredId(null)}
					>
						{/* 指示条 - 使用 CSS 变量控制位置 (Desktop Only) */}
						<div
							ref={indicatorRef}
							className="hidden lg:block absolute left-0 w-[3px] bg-accent-500 rounded-r-full shadow-[0_0_10px_rgba(45,212,191,0.5)] pointer-events-none z-10 transition-all duration-200 ease-out"
							style={{
								top: "var(--indicator-top, 0)",
								height: "var(--indicator-height, 0)",
								opacity: activeItem ? 1 : 0,
							}}
						/>

						{items.map((item) => {
							const isActive = activeItem?._id === item._id;
							const itemUrl = getItemUrl(item);

							return (
								<Link
									key={item._id}
									ref={(el) => {
										if (el)
											itemRefs.current.set(item._id, el);
									}}
									href={itemUrl}
									onMouseEnter={() => handleMouseEnter(item._id)}
									className="group relative block outline-none border-b border-dashed border-border/30 lg:border-0 last:border-0"
								>
									<motion.div
										className="absolute -inset-y-1 md:-inset-y-2 -inset-x-2 md:-inset-x-4 rounded-xl -z-10"
										animate={{
											backgroundColor: isActive && !isMobile ? "var(--bg-glass)" : "transparent",
										}}
										style={{
											backgroundColor: isActive && !isMobile ? "rgba(var(--primary-100), 0.5)" : "transparent",
										}}
									/>

									<div className="flex items-baseline justify-between gap-3 md:gap-6 py-3 md:py-2 pl-3 md:pl-6 transition-transform duration-200 group-hover:translate-x-1">
										<h3 className={cn(
											"text-base md:text-lg min-w-0 flex-1 truncate transition-colors duration-200",
											isActive && !isMobile
												? "text-accent-600 dark:text-accent-400 font-semibold"
												: "text-foreground/80 font-medium",
										)}
										>
											{item.title}
										</h3>

										<div className={cn(
											"shrink-0 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm transition-colors min-w-[50px] md:min-w-[60px] justify-end",
											isActive && !isMobile ? "text-accent-600/80" : "text-muted-foreground/50",
										)}
										>
											<SmartDate
												date={item.created}
												modifiedDate={item.modified}
												className="font-mono"
											/>
										</div>
									</div>
								</Link>
							);
						})}
					</div>

					{/* Pagination */}
					{pagination.totalPages > 1 && (
						<div className="flex justify-center gap-2 py-6 md:py-8 border-t border-border/40 mt-2 md:mt-4">
							<button
								type="button"
								disabled={pagination.currentPage <= 1}
								onClick={() => handlePageChange(pagination.currentPage - 1)}
								className="p-1.5 md:p-2 rounded-lg hover:bg-primary-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
								aria-label="上一页"
							>
								<Icon icon="mingcute:left-line" className="w-4 h-4 md:w-5 md:h-5" />
							</button>

							<span className="flex items-center px-3 md:px-4 font-mono text-xs md:text-sm text-muted-foreground">
								<span className="hidden sm:inline">Page </span>
								{pagination.currentPage}
								{" "}
								/
								{" "}
								{pagination.totalPages}
							</span>

							<button
								type="button"
								disabled={pagination.currentPage >= pagination.totalPages}
								onClick={() => handlePageChange(pagination.currentPage + 1)}
								className="p-1.5 md:p-2 rounded-lg hover:bg-primary-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
								aria-label="下一页"
							>
								<Icon icon="mingcute:right-line" className="w-4 h-4 md:w-5 md:h-5" />
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
