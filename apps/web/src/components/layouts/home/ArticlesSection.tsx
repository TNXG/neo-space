import type { Post } from "@/types/api";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();

  return (
    <section id="articles">
      <SectionHeader
        title={t("home.section.articles")}
        icon="mingcute:book-2-line"
        linkText={t("home.section.readAll")}
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
