import type { ReactNode } from "react";
import type { TOCItem } from "@/lib/toc";
import { ArticleContent } from "./ArticleContent";
import { ArticleTOC } from "./ArticleTOC";

interface ArticleLayoutProps {
	/** 文章头部（标题、元信息等） */
	header: ReactNode;
	/** 文章正文内容 */
	content: ReactNode;
	/** 目录数据 */
	toc: TOCItem[];
	/** 文章底部（评论、相关文章等） */
	footer?: ReactNode;
}

/**
 * 文章布局组件
 * 桌面端：左侧正文 + 右侧 TOC
 * 移动端：单列布局，TOC 隐藏
 */
export function ArticleLayout({
	header,
	content,
	toc,
	footer,
}: ArticleLayoutProps) {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="max-w-7xl mx-auto pt-24 pb-16 px-4 lg:px-8">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
					{/* 左侧正文区 (9列) */}
					<article className="lg:col-span-9 min-w-0">
						{header}
						<div className="prose-container">
							<ArticleContent items={toc}>
								{content}
							</ArticleContent>
						</div>
						{footer && (
							<div className="mt-16 pt-8 border-t border-border/50">
								{footer}
							</div>
						)}
					</article>

					{/* 右侧 TOC 区 (3列) - 仅桌面端显示 */}
					<aside className="hidden lg:block lg:col-span-3">
						<ArticleTOC />
					</aside>
				</div>
			</div>
		</main>
	);
}
