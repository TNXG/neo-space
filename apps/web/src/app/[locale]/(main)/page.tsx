import { MarkdownPreview } from "@/components/common/markdown";
import { HomePage } from "@/components/layouts/HomePage";
import { getHomePageNotes, getHomePagePosts, getRecently, getUserProfile } from "@/lib/api-client";

export const revalidate = 57600;
export const dynamicParams = true;

/**
 * Homepage - Server Component
 * Fetches data from API and passes to client component
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Fetch data from backend API（使用首页专用 API，带 home 标签）
  const [postsResponse, notesResponse, recentlyResponse, profileResponse] = await Promise.all([
    getHomePagePosts(5, locale).catch(() => ({ data: { items: [] } })),
    getHomePageNotes(5, locale).catch(() => ({ data: { items: [] } })),
    getRecently(5).catch(() => ({ data: { items: [] } })),
    getUserProfile().catch(() => ({
      data: {
        _id: "",
        username: "guest",
        name: "访客用户",
        introduce: "欢迎来到我的博客",
        avatar: "/default-avatar.png",
        mail: "",
        url: "",
        created: new Date().toISOString(),
        last_login_time: new Date().toISOString(),
      },
    })),
  ]);
  const posts = postsResponse.data?.items ?? [];
  const notes = notesResponse.data?.items ?? [];
  const recently = recentlyResponse.data?.items ?? [];

  // 服务端预渲染碎碎念的 markdown 内容
  const recentlyWithRendered = recently.map(item => ({
    ...item,
    renderedContent: item.content
      ? <MarkdownPreview content={item.content} maxLength={200} />
      : null,
  }));

  return (
    <>
      <HomePage
        profile={profileResponse.data}
        articles={posts}
        notes={notes}
        recently={recentlyWithRendered}
      />
    </>
  );
}
