"use client";

import { Icon } from "@iconify/react/offline";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ArticleNavButtonsProps {
	prevLink?: string;
	nextLink?: string;
	prevTitle?: string;
	nextTitle?: string;
	type?: "post" | "note";
}

/**
 * 文章/手记底部导航组件
 * 包含：返回/首页 (系统导航) + 上一篇/下一篇 (内容导航)
 */
export function ArticleNavButtons({
	prevLink,
	nextLink,
	prevTitle,
	nextTitle,
	type = "post",
}: ArticleNavButtonsProps) {
	const router = useRouter();

	const handleBack = () => {
		if (window.history.length > 1) {
			router.back();
		} else {
			router.push("/");
		}
	};

	const contentType = type === "note" ? "手记" : "文章";

	return (
		<nav className="w-full mt-16 pt-8 border-t border-border/40">
			<div className="flex flex-col gap-6">

				{/* 1. 系统导航 (小按钮区域) */}
				<div className="flex items-center justify-between text-sm">
					<button
						type="button"
						onClick={handleBack}
						className="group flex items-center gap-1.5 px-3 py-1.5 -ml-3 text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-primary-100 cursor-pointer"
					>
						<Icon
							icon="mingcute:arrow-left-line"
							className="text-lg transition-transform group-hover:-translate-x-0.5"
						/>
						<span className="font-medium">返回</span>
					</button>

					<Link
						href="/"
						className="group flex items-center gap-1.5 px-3 py-1.5 -mr-3 text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-primary-100 cursor-pointer"
					>
						<span className="font-medium">首页</span>
						<Icon
							icon="mingcute:home-2-line"
							className="text-lg mb-0.5 transition-transform group-hover:scale-110"
						/>
					</Link>
				</div>

				{/* 2. 内容导航 (大卡片区域) */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{/* Previous */}
					{prevLink
						? (
								<Link
									href={prevLink}
									className="group relative flex flex-col justify-between p-4 min-h-[88px] rounded-xl border border-border/60 bg-primary-50/50 hover:border-accent-200 hover:bg-accent-50/50 transition-all duration-300 cursor-pointer"
								>
									{/* Hover Indicator */}
									<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 bg-accent-500 rounded-r-full group-hover:h-10 transition-all duration-300 opacity-0 group-hover:opacity-100" />

									<div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground group-hover:text-accent-600 transition-colors uppercase tracking-wider">
										<Icon icon="mingcute:left-line" className="text-xs" />
										<span>Previous</span>
									</div>
									<div className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors line-clamp-2 mt-1">
										{prevTitle || `上一篇${contentType}`}
									</div>
								</Link>
							)
						: (
								<div className="hidden sm:flex flex-col justify-between p-4 min-h-[88px] rounded-xl border border-dashed border-border/40 bg-transparent opacity-40 cursor-not-allowed">
									<div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
										<Icon icon="mingcute:ban-line" className="text-xs" />
										<span>Previous</span>
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										没有更早的
										{contentType}
										了
									</div>
								</div>
							)}

					{/* Next */}
					{nextLink
						? (
								<Link
									href={nextLink}
									className="group relative flex flex-col justify-between items-end p-4 min-h-[88px] rounded-xl border border-border/60 bg-primary-50/50 hover:border-accent-200 hover:bg-accent-50/50 transition-all duration-300 text-right cursor-pointer"
								>
									{/* Hover Indicator */}
									<div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-0 bg-accent-500 rounded-l-full group-hover:h-10 transition-all duration-300 opacity-0 group-hover:opacity-100" />

									<div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground group-hover:text-accent-600 transition-colors uppercase tracking-wider">
										<span>Next</span>
										<Icon icon="mingcute:right-line" className="text-xs" />
									</div>
									<div className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors line-clamp-2 mt-1">
										{nextTitle || `下一篇${contentType}`}
									</div>
								</Link>
							)
						: (
								<div className="hidden sm:flex flex-col justify-between items-end p-4 min-h-[88px] rounded-xl border border-dashed border-border/40 bg-transparent opacity-40 cursor-not-allowed text-right">
									<div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
										<span>Next</span>
										<Icon icon="mingcute:ban-line" className="text-xs" />
									</div>
									<div className="text-xs text-muted-foreground mt-1">已经是最后一篇了</div>
								</div>
							)}
				</div>
			</div>
		</nav>
	);
}
