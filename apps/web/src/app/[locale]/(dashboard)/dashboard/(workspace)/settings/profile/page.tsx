import type { Metadata } from "next";
import { ProfileForm } from "@/components/dashboard/settings/profile-form";

export const metadata: Metadata = { title: "用户 · 设置" };

/** 静态路由编排资料表单；读写由浏览器直连 Owner API。 */
export default function ProfileSettingsPage() {
  return <ProfileForm />;
}
