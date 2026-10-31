import type { Metadata } from "next";
import { FriendManager } from "@/components/dashboard/friends/FriendManager";

export const metadata: Metadata = { title: "友链" };

/** 友链管理在客户端读取，健康与订阅状态由 Rust 缓存提供。 */
export default function DashboardFriendsPage() {
  return <FriendManager />;
}
