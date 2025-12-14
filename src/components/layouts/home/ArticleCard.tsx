import type { Post } from "@/types/api";
import { AbbreviationText } from "@/components/common/nbnhhsh";

interface ArticleCardProps {
	article: Post;
}

/**
 * Article card component with two display variants
 * - Featured: Large card with summary
 * - List: Compact list item
 */
export function ArticleCard({ article }: ArticleCardProps) {
	const formattedDate = article.created
		? new Date(article.created).toLocaleDateString("zh-CN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			})
		: "";

	return (
		<div className="group py-3 border-b border-dashed border-neutral-300 flex cursor-pointer items-baseline justify-between last:border-0">
			<h3 className="text-lg font-medium transition-colors duration-150 text-primary-500 group-hover:text-accent-600">
				<AbbreviationText>{article.title}</AbbreviationText>
			</h3>
			<span className="text-sm font-mono ml-4 shrink-0 text-neutral-500">
				{formattedDate}
			</span>
		</div>
	);
}
