import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/common/PageHero";
import { ThinkingItem, ThinkingList } from "@/components/layouts/thinking";
import { getRecently } from "@/lib/api-client";

interface ThinkingPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ThinkingPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("thinking.meta.title"),
    description: t("thinking.meta.description"),
  };
}

export const revalidate = 3600;

/**
 * 碎碎念页面 - 流式展示
 * 使用 Server Components 和 Server Action 实现无限加载
 */
export default async function ThinkingPage({ params }: ThinkingPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const limit = 50;
  // 获取首屏数据，支持 SSR
  const initialDataResponse = await getRecently(limit);
  const items = initialDataResponse.data.items;
  const initialHasNextPage = initialDataResponse.data.pagination.has_next_page;
  const isEmpty = items.length === 0;

  // 在服务端渲染首屏的节点
  const initialNodes = items.map(item => <ThinkingItem key={item._id} item={item} />);

  return (
    <main className="container mx-auto px-4 py-16 max-w-4xl">
      <PageHero
        title={t("thinking.title")}
        eyebrow={t("thinking.eyebrow")}
        subtitle={t("thinking.subtitle")}
        subtitleAlt={t("thinking.subtitleAlt")}
        className="mb-16 text-center"
      />

      {/* 碎碎念列表客户端组件 */}
      <ThinkingList
        initialNodes={initialNodes}
        initialHasNextPage={initialHasNextPage}
        isEmpty={isEmpty}
      />
    </main>
  );
}
