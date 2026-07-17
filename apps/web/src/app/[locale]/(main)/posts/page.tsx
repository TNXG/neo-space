import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PostInteractiveList } from "@/components/common/InteractiveList";
import { PageHero } from "@/components/common/PageHero";
import { getPosts } from "@/lib/api-client";

interface PostsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PostsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("posts.meta.title"),
    description: t("posts.meta.description"),
  };
}

// ISR 配置：16小时兜底过期，后台内容变更后会主动刷新
export const revalidate = 57600;

/**
 * 默认显示第一页
 * 不携带任何参数，完全静态化
 */
export default async function PostsPage({
  params,
}: PostsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const page = 1;
  const pageSize = 10;
  const { data } = await getPosts(page, pageSize, locale);

  return (
    <main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
      <PageHero
        title={t("posts.hero.title")}
        eyebrow={t("posts.hero.eyebrow")}
        subtitle={t("posts.hero.subtitle")}
        subtitleAlt={t("posts.hero.subtitleAlt")}
      />

      <PostInteractiveList
        items={data.items}
        emptyMessage={t("interactive.empty.post")}
      />
    </main>
  );
}
