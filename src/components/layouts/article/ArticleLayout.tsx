import type { ReactNode } from "react";
import type { TOCItem } from "@/lib/toc";
import { ArticleContent } from "./ArticleContent";
import { ArticleNavButtons } from "./ArticleNavButtons";
import { ArticleTOC } from "./ArticleTOC";
import { ArticleTOCWrapper } from "./ArticleTOCWrapper";

export interface ArticleNavigation {
	prevLink?: string;
	nextLink?: string;
	prevTitle?: string;
	nextTitle?: string;
	type?: "post" | "note";
}

interface ArticleLayoutProps {
	/** 文章头部（标题、元信息等） */
	header: ReactNode;
	/** 文章正文内容 */
	content: ReactNode;
	/** 目录数据 */
	toc: TOCItem[];
	/** 文章底部（评论、相关文章等） */
	footer?: ReactNode;
	/** 导航数据 */
	navigation?: ArticleNavigation;
}

/**
 * 文章布局组件
 * 桌面端：正文居中 + TOC 浮动在右侧（不挤压正文）
 * 移动端：单列布局，TOC 隐藏
 */
export function ArticleLayout({
	header,
	content,
	toc,
	footer,
	navigation,
}: ArticleLayoutProps) {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="max-w-7xl mx-auto pt-16 md:pt-24 pb-12 md:pb-16 px-4 lg:px-8 relative">
				{/* 正文区 - 居中显示，TOC 跟随此区域 */}
				<div className="relative" data-toc-boundary>
					<article className="max-w-3xl mx-auto min-w-0">
						{header}
						<div className="prose-container">
							<ArticleContent items={toc}>
								{content}
							</ArticleContent>
						</div>
					</article>

					{/* 右侧 TOC 区 - 使用智能定位包装器 */}
					<ArticleTOCWrapper>
						<ArticleTOC />
						{navigation && <ArticleNavButtons {...navigation} />}
					</ArticleTOCWrapper>
				</div>

				{/* Footer 区域（评论等）- 独立于 TOC 边界 */}
				{footer && (
					<div className="max-w-3xl mx-auto mt-16 pt-8 border-t border-border/50">
						{footer}
					</div>
				)}
			</div>
		</main>
	);
}
