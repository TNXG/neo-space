import type { Post } from "@/types/api";
import Link from "next/link";
import { AbbreviationText } from "@/components/common/nbnhhsh";
import { SmartDate } from "@/components/common/smart-date";

interface ArticlePreviewProps {
	article: Post;
}

/**
 * Article preview component for home page
 * Provides brief information about articles in a compact format
 */
export function ArticlePreview({ article }: ArticlePreviewProps) {
	const categorySlug = article.category?.slug || "default";
	const postUrl = `/posts/${categorySlug}/${article.slug}`;

	return (
		<Link href={postUrl} className="group py-2.5 md:py-3 border-b border-dashed border-border flex cursor-pointer items-baseline justify-between last:border-0 gap-3 md:gap-4">
			<h3 className="text-base md:text-lg font-medium transition-colors duration-150 text-foreground/70 group-hover:text-primary min-w-0 flex-1 wrap-break-word pr-2 md:pr-4">
				<AbbreviationText>{article.title}</AbbreviationText>
			</h3>
			{article.created && (
				<SmartDate
					date={article.created}
					modifiedDate={article.modified}
					className="text-xs md:text-sm font-mono shrink-0 text-muted-foreground"
				/>
			)}
		</Link>
	);
}
