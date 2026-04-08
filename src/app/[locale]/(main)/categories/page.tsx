import type { Metadata } from "next";
import type { Post } from "@/types/api";
import { getTranslations } from "next-intl/server";
import { CategoryInteractiveList } from "@/components/common/InteractiveList";
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
    getCategories(),
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
      <header className="mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
        <div className="mb-4 md:mb-6 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-r from-primary-800 to-accent-600 bg-clip-text text-transparent leading-tight py-2 select-none">
            {t("category.title")}
          </h1>
          <span className="text-xs md:text-sm lg:text-base font-medium tracking-[0.3em] text-accent-600/60 uppercase mt-1 font-mono">
            Categories
          </span>
        </div>

        <div className="text-primary-600 font-medium flex items-center justify-center gap-3 md:gap-4 w-full">
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70" />
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-base md:text-lg lg:text-xl tracking-wide text-primary-700">
              {t("category.summary", { categories: categories.length, posts: allPosts.length })}
            </span>
            <span className="text-[11px] md:text-xs lg:text-sm text-primary-400/80 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
              Organized by topics
            </span>
          </div>
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70" />
        </div>
      </header>

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
