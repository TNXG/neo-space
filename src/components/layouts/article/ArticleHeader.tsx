import type { Category } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import Link from "next/link";
import { SmartDate } from "@/components/common/smart-date";

interface ArticleHeaderProps {
	title: string;
	category?: Category;
	tags?: string[];
	created: string;
	modified?: string;
	summary?: string;
	/** AI 生成的摘要 */
	aiSummary?: string;
	/** 文章类型标签 */
	typeLabel?: string;
}

const EMPTY_TAGS: string[] = [];

/**
 * 文章头部组件
 * 显示标题、分类、标签、日期等元信息
 */
export function ArticleHeader({
	title,
	category,
	tags = EMPTY_TAGS,
	created,
	modified,
	summary,
	aiSummary,
	typeLabel = "Article",
}: ArticleHeaderProps) {
	// 优先使用 AI 摘要，否则使用手动摘要
	const displaySummary = aiSummary || summary;
	const isAiSummary = !!aiSummary;

	return (
		<header className="mb-12 pb-8 border-b border-border/50">
			{/* 类型标签 */}
			<span className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4 block">
				{typeLabel}
			</span>

			{/* 标题 */}
			<h1 className="text-3xl lg:text-5xl font-bold text-foreground mb-6 leading-tight tracking-tight">
				{title}
			</h1>

			{/* 摘要 */}
			{displaySummary && (
				<div className="my-6 pl-4 border-l-4 border-accent-400">
					{isAiSummary && (
						<div className="flex items-center gap-1.5 mb-2">
							<Icon icon="mingcute:sparkles-line" className="w-4 h-4 text-accent-500" />
							<span className="text-xs font-medium text-accent-600">
								AI 摘要
							</span>
						</div>
					)}
					<p className="text-base text-foreground/80 leading-relaxed">
						{displaySummary}
					</p>
				</div>
			)}

			{/* 元信息 */}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
				{/* 分类 */}
				{category && (
					<Link
						href={`/category/${category.slug}`}
						className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/50 text-accent-foreground hover:bg-accent transition-colors cursor-pointer"
					>
						<span className="w-1.5 h-1.5 rounded-full bg-accent-600" />
						{category.name}
					</Link>
				)}

				{/* 发布日期 */}
				<span className="flex items-center gap-1.5">
					<span className="text-muted-foreground/60">发布于</span>
					<SmartDate date={created} />
				</span>

				{/* 更新日期 */}
				{modified && modified !== created && (
					<span className="flex items-center gap-1.5">
						<span className="text-muted-foreground/60">·</span>
						<span className="text-muted-foreground/60">更新于</span>
						<SmartDate date={modified} />
					</span>
				)}
			</div>

			{/* 标签 */}
			{tags.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-4">
					{tags.map(tag => (
						<span
							key={tag}
							className="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700"
						>
							#
							{tag}
						</span>
					))}
				</div>
			)}
		</header>
	);
}
