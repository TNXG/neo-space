import type { Metadata } from "next";
import type { Link } from "@/types/api";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { FriendsList } from "@/components/layouts/friends/FriendsList";
import { LinkApplyForm } from "@/components/layouts/friends/LinkApplyForm";
import { getLinks } from "@/lib/api-client";
import { LinkType } from "@/types/api";

export const metadata: Metadata = {
  title: "Constellation | 友链",
  description: "星座图谱，连接志同道合的朋友",
};

// 使用基于标签的 ISR 缓存策略
// 当后端健康检查更新时，会主动触发 revalidateTag("links")
export const revalidate = false;

/**
 * 加载全部友链（遍历所有分页）
 */
async function getAllLinks(): Promise<Link[]> {
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
}

/**
 * 友链页面
 */
export default async function FriendsPage() {
  const allLinks = await getAllLinks();

  // 按类型分组
  const friends = allLinks.filter(link => link.type === LinkType.FRIEND);
  const collections = allLinks.filter(link => link.type === LinkType.COLLECTION);

  return (
    <main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
      {/* 页面头部 */}
      <header className="mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
        <div className="mb-4 md:mb-6 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-r from-accent-600 to-primary-700 bg-clip-text text-transparent leading-tight py-2 select-none">
            星 座
          </h1>
          <span className="text-xs md:text-sm lg:text-base font-medium tracking-[0.3em] text-primary-500/60 uppercase mt-1 font-mono">
            Constellation
          </span>
        </div>

        <div className="text-primary-600 font-medium flex items-center justify-center gap-3 md:gap-4 w-full">
          <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70"></span>
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-base md:text-lg lg:text-xl tracking-wide text-primary-700">
              以光为线，连接彼此
            </span>
            <span className="text-[11px] md:text-xs lg:text-sm text-primary-400/80 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
              Connected by starlight
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
