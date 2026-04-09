import type { Metadata } from "next";
import type { Link } from "@/types/api";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { FriendsList } from "@/components/layouts/friends/FriendsList";
import { LinkApplyForm } from "@/components/layouts/friends/LinkApplyForm";
import { getLinks } from "@/lib/api-client";
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
  const allLinks = await getAllLinks();

  // 按类型分组
  const friends = allLinks.filter(link => link.type === LinkType.FRIEND);
  const collections = allLinks.filter(link => link.type === LinkType.COLLECTION);

  return (
    <main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
      {/* 页面头部 */}
      <header className="mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
        <div className="mb-4 md:mb-6 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-r from-primary-800 to-accent-600 bg-clip-text text-transparent leading-tight py-2 select-none">
            {t("friends.title")}
          </h1>
          <span className="text-xs md:text-sm lg:text-base font-medium tracking-[0.3em] text-accent-600/60 uppercase mt-1 font-mono">
            {t("friends.eyebrow")}
          </span>
        </div>

        <div className="text-primary-600 font-medium flex items-center justify-center gap-3 md:gap-4 w-full">
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70"></span>
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-base md:text-lg lg:text-xl tracking-wide text-primary-700">
              {t("friends.subtitle")}
            </span>
            <span className="text-[11px] md:text-xs lg:text-sm text-primary-400/80 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
              {t("friends.subtitleAlt")}
            </span>
          </div>
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70"></span>
        </div>
      </header>

      <FriendsList friends={friends} collections={collections} />

      {/* 友链申请表单 */}
      <LinkApplyForm />

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
