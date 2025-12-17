import type { Post } from "@/types/api";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ArticleCard } from "./ArticleCard";

interface ArticlesSectionProps {
	articles: Post[];
}

/**
 * Articles section component
 * Displays featured article and list of recent articles
 */
export function ArticlesSection({ articles }: ArticlesSectionProps) {
	return (
		<section id="articles">
			<SectionHeader
				title="文章"
				icon="mingcute:book-2-line"
				linkText="阅读全部"
				linkHref="/posts"
			/>
			<div className="space-y-4">
				{articles.map(article => (
					<ArticleCard key={article._id} article={article} />
				))}
			</div>
		</section>
	);
}
