import type { Metadata } from "next";
import type { Post } from "@/types/api";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostInteractiveList } from "@/components/common/InteractiveList";
import { getCategories, getPosts } from "@/lib/api-client";

export const revalidate = 57600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
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
  const { slug } = await params;
  try {
    const { data: categories } = await getCategories();
    const cat = categories.find(c => c.slug === slug);
    if (!cat)
      return { title: "分类不存在" };
    return {
      title: `${cat.name} | 分类`,
      description: `浏览「${cat.name}」下的所有文章`,
    };
  } catch {
    return { title: "分类" };
  }
}

/**
 * 分批获取所有已发布文章并按分类过滤
 */
async function getPostsByCategorySlug(slug: string): Promise<{ posts: Post[]; categoryName: string }> {
  const allPosts: Post[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data } = await getPosts(page, 100);
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
  const { slug } = await params;

  const [categoriesRes, { posts, categoryName }] = await Promise.all([
    getCategories(),
    getPostsByCategorySlug(slug),
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
              共
              {" "}
              {posts.length}
              {" "}
              篇文章
            </span>
            <span className="text-[11px] md:text-xs lg:text-sm text-primary-400/80 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
              <Link href="/categories" className="hover:text-accent-600 transition-colors underline underline-offset-4 decoration-accent-300/50 hover:decoration-accent-600">
                返回全部分类
              </Link>
            </span>
          </div>
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70" />
        </div>
      </header>

      <PostInteractiveList
        items={posts}
        emptyMessage="选择一篇文章查看详情"
        staticMode
      />
    </main>
  );
}
