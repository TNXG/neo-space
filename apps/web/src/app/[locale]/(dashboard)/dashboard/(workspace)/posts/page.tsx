import type { Metadata } from "next";
import { PostList } from "@/components/dashboard/content/PostList";

export const metadata: Metadata = { title: "文章" };

/** 文章列表在客户端读取 Owner 视角数据。 */
export default function DashboardPostsPage() {
  return <PostList />;
}
