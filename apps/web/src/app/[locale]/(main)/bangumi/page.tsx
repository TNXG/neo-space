import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/common/PageHero";
import { BangumiLibrary } from "@/components/layouts/bangumi/BangumiLibrary";
import { BangumiUnavailable } from "@/components/layouts/bangumi/BangumiUnavailable";
import { getBangumiLibrary } from "@/lib/bangumi";

interface BangumiPageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = "force-dynamic";

/** 生成 Bangumi 收藏页的本地化 SEO 信息。 */
export async function generateMetadata({ params }: BangumiPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bangumi" });

  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

/** 编排 Bangumi 数据读取与页面级降级状态。 */
export default async function BangumiPage() {
  const t = await getTranslations("bangumi");
  let library = null;
  let loadFailed = false;

  try {
    library = await getBangumiLibrary();
  } catch (error) {
    loadFailed = true;
    console.error("Failed to load Bangumi library:", error);
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <PageHero
        title={t("title")}
        eyebrow={t("eyebrow")}
        subtitle={t("subtitle")}
        subtitleAlt={t("subtitleAlt")}
      />

      {library
        ? <BangumiLibrary data={library} />
        : (
            <BangumiUnavailable
              title={loadFailed ? t("unavailable.title") : t("unconfigured.title")}
              description={loadFailed ? t("unavailable.description") : t("unconfigured.description")}
            />
          )}
    </main>
  );
}
