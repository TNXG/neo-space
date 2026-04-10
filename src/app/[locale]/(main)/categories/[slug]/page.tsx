import type { Metadata } from "next";
import type { Post } from "@/types/api";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PostInteractiveList } from "@/components/common/InteractiveList";
import { PageHero } from "@/components/common/PageHero";
import { getCategories, getPosts } from "@/lib/api-client";
import { Link } from "@/locales/navigation";

export const revalidate = 57600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  try {
    const { data } = await getCategories();
    return data.map(cat => ({ slug: cat.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  try {
    const { data: categories } = await getCategories(locale);
    const cat = categories.find(c => c.slug === slug);
    if (!cat)
      return { title: t("category.detail.notFound") };
    return {
      title: t("category.detail.metaTitle", { name: cat.name }),
      description: t("category.detail.metaDescription", { name: cat.name }),
    };
  } catch {
    return { title: t("category.detail.fallbackTitle") };
  }
}

/**
 * 分批获取所有已发布文章并按分类过滤
 */
async function getPostsByCategorySlug(slug: string, locale: string): Promise<{ posts: Post[]; categoryName: string }> {
  const allPosts: Post[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data } = await getPosts(page, 100, locale);
    allPosts.push(...(data.items as Post[]));
    hasMore = data.pagination.has_next_page;
    page++;
    // 安全阈值，避免无限循环
    if (page > 10)
      break;
  }

  const filtered = allPosts.filter(p => p.category?.slug === slug);
  const categoryName = filtered[0]?.category?.name ?? slug;
  return { posts: filtered, categoryName };
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });

  const [categoriesRes, { posts, categoryName }] = await Promise.all([
    getCategories(locale),
    getPostsByCategorySlug(slug, locale),
  ]);

  const categories = categoriesRes.data ?? [];
  const cat = categories.find(c => c.slug === slug);

  if (!cat)
    notFound();

  const displayName = cat?.name ?? categoryName;

  return (
    <main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
      <PageHero
        title={displayName}
        eyebrow={slug}
        subtitle={t("category.detail.total", { count: posts.length })}
        subtitleAlt={(
          <Link href="/categories" className="hover:text-accent-600 transition-colors underline underline-offset-4 decoration-accent-300/50 hover:decoration-accent-600">
            {t("category.detail.backToCategories")}
          </Link>
        )}
      />

      <PostInteractiveList
        items={posts}
        emptyMessage={t("interactive.empty.post")}
        staticMode
      />
    </main>
  );
}
