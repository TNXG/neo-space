import { redirect } from "@/locales/navigation";

/** 设置默认打开当前已实现的 Profile 分组。 */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/dashboard/settings/profile", locale });
}
