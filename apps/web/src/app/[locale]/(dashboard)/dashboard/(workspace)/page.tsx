import type { Metadata } from "next";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export const metadata: Metadata = { title: "工作区总览" };

/** 后台路由仅编排静态外壳，身份由浏览器直接读取 Rust Cookie 会话。 */
export default function DashboardPage() {
  return <DashboardOverview />;
}
