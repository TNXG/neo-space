import type { Metadata } from "next";
import { DashboardWorkspace } from "@/components/business/dashboard/DashboardWorkspace";
import { ProfileSettings } from "@/components/business/dashboard/settings/ProfileSettings";

export const metadata: Metadata = { title: "用户 · 设置" };

/** 静态路由编排，Profile 由客户端通过 Cookie API 读取和保存。 */
export default function ProfileSettingsPage() {
  return <DashboardWorkspace><ProfileSettings /></DashboardWorkspace>;
}
