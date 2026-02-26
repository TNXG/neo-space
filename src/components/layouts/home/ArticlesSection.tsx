import type { Post } from "@/types/api";

import Book2Line from "~icons/mingcute/book-2-line";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ArticlePreview } from "./ArticlePreview";

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
        icon={Book2Line}
        linkText="阅读全部"
        linkHref="/posts"
      />
      <div className="space-y-4">
        {articles.map(article => (
          <ArticlePreview key={article._id} article={article} />
        ))}
      </div>
    </section>
  );
}
