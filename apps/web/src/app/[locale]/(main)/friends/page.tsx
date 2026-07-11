import type { Metadata } from "next";
import type { Link } from "@/types/api";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { PageHero } from "@/components/common/PageHero";
import { FriendsList } from "@/components/layouts/friends/FriendsList";
import { LinkApplyForm } from "@/components/layouts/friends/LinkApplyForm";
import { getLinks, getSiteConfig } from "@/lib/api-client";
import { LinkType } from "@/types/api";

interface FriendsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: FriendsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("friends.meta.title"),
    description: t("friends.meta.description"),
  };
}

export const revalidate = 57600;
export const dynamicParams = true;

/**
 * 加载全部友链（遍历所有分页）
 */
async function getAllLinks(): Promise<Link[]> {
  try {
    const allItems: Link[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const { data } = await getLinks(page, 50);
      allItems.push(...data.items);
      totalPages = data.pagination.total_page || 1;
      page++;
    } while (page <= totalPages);

    return allItems;
  } catch (error) {
    console.error("Failed to fetch links during build:", error);
    // 构建时如果 API 不可用，返回空数组
    return [];
  }
}

/**
 * 友链页面
 */
export default async function FriendsPage() {
  const t = await getTranslations();
  const [allLinks, siteConfig] = await Promise.all([
    getAllLinks(),
    getSiteConfig().catch(() => null),
  ]);

  // 按类型分组
  const friends = allLinks.filter(link => link.type === LinkType.FRIEND);
  const collections = allLinks.filter(link => link.type === LinkType.COLLECTION);

  return (
    <main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
      <PageHero
        title={t("friends.title")}
        eyebrow={t("friends.eyebrow")}
        subtitle={t("friends.subtitle")}
        subtitleAlt={t("friends.subtitleAlt")}
      />

      <FriendsList friends={friends} collections={collections} />

      {siteConfig?.data.friend_link.allowApply && <LinkApplyForm />}

      {/* 评论区 */}
      <Suspense fallback={<CommentSkeleton />}>
        <CommentSectionServer
          refId="friends"
          refType="pages"
        />
      </Suspense>
    </main>
  );
}
