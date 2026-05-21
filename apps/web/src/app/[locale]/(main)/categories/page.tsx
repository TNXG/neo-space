import type { Metadata } from "next";
import type { Post } from "@/types/api";
import { getTranslations } from "next-intl/server";
import { CategoryInteractiveList } from "@/components/common/InteractiveList";
import { PageHero } from "@/components/common/PageHero";
import { getCategories, getPosts } from "@/lib/api-client";
import { Icon } from "@/lib/inline-icon";

export const revalidate = 57600;

interface CategoriesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CategoriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("category.meta.title"),
    description: t("category.meta.description"),
  };
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const [categoriesRes, postsRes] = await Promise.all([
    getCategories(locale),
    getPosts(1, 100, locale),
  ]);

  const categories = categoriesRes.data ?? [];
  const allPosts = (postsRes.data?.items ?? []) as Post[];

  // 按分类统计文章数
  const countMap: Record<string, number> = {};
  for (const post of allPosts) {
    const slug = post.category?.slug;
    if (slug) {
      countMap[slug] = (countMap[slug] || 0) + 1;
    }
  }

  // 每个分类的最新文章
  const latestPostMap: Record<string, Post> = {};
  for (const post of allPosts) {
    const slug = post.category?.slug;
    if (!slug)
      continue;
    if (!latestPostMap[slug] || new Date(post.created) > new Date(latestPostMap[slug].created)) {
      latestPostMap[slug] = post;
    }
  }

  // 按文章数降序排列
  const sortedCategories = categories.toSorted((a, b) => (countMap[b.slug] || 0) - (countMap[a.slug] || 0));

  return (
    <main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
      <PageHero
        title={t("category.title")}
        eyebrow={t("category.eyebrow")}
        subtitle={t("category.summary")}
        subtitleAlt={t("category.summaryAlt")}
      />

      {categories.length === 0
        ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-primary-200 dark:border-primary-800">
              <Icon icon="mingcute:ghost-line" className="w-10 h-10 text-primary-400 dark:text-primary-500 mb-3" />
              <h3 className="text-sm font-medium text-primary-600 dark:text-primary-300 mb-1">{t("category.emptyTitle")}</h3>
              <p className="text-xs text-primary-400 dark:text-primary-500">{t("category.emptyDescription")}</p>
            </div>
          )
        : (
            <CategoryInteractiveList
              items={sortedCategories}
              allPosts={allPosts}
              countMap={countMap}
              latestPostMap={latestPostMap}
            />
          )}
    </main>
  );
}
