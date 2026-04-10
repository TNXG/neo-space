import type { Metadata } from "next";
import type { Post } from "@/types/api";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PostInteractiveList } from "@/components/common/InteractiveList";
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
      <header className="mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
        <div className="mb-4 md:mb-6 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-r from-primary-800 to-accent-600 bg-clip-text text-transparent leading-tight py-2 select-none">
            {displayName}
          </h1>
          <span className="text-xs md:text-sm lg:text-base font-medium tracking-[0.3em] text-accent-600/60 uppercase mt-1 font-mono">
            {slug}
          </span>
        </div>

        <div className="text-primary-600 font-medium flex items-center justify-center gap-3 md:gap-4 w-full">
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70" />
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-base md:text-lg lg:text-xl tracking-wide text-primary-700">
              {t("category.detail.total", { count: posts.length })}
            </span>
            <span className="text-[11px] md:text-xs lg:text-sm text-primary-400/80 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
              <Link href="/categories" className="hover:text-accent-600 transition-colors underline underline-offset-4 decoration-accent-300/50 hover:decoration-accent-600">
                {t("category.detail.backToCategories")}
              </Link>
            </span>
          </div>
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70" />
        </div>
      </header>

      <PostInteractiveList
        items={posts}
        emptyMessage={t("interactive.empty.post")}
        staticMode
      />
    </main>
  );
}
