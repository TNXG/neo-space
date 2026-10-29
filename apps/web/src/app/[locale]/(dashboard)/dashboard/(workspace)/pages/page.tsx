import type { Metadata } from "next";
import { PageList } from "@/components/dashboard/content/PageList";

export const metadata: Metadata = { title: "页面" };

/** 独立页面列表在客户端读取。 */
export default function DashboardPagesPage() {
  return <PageList />;
}
