import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardWorkspace } from "@/components/business/dashboard/DashboardWorkspace";
import { SettingsForm } from "@/components/business/dashboard/settings/settings-form";
import { findSettingGroup } from "@/components/business/dashboard/settings/settings-groups";

type SettingsRouteProps = { params: Promise<{ group: string }> };

/** 只读取本地分组目录生成标题，不在 RSC 获取配置。 */
export async function generateMetadata({ params }: SettingsRouteProps): Promise<Metadata> {
  const { group } = await params;
  return { title: `${findSettingGroup(group)?.title ?? "设置"} · 设置` };
}

/** 路由仅编排客户端表单；未知分组返回 404。 */
export default async function SettingsGroupPage({ params }: SettingsRouteProps) {
  const { group: slug } = await params;
  const group = findSettingGroup(slug);
  if (!group) notFound();
  return <DashboardWorkspace><SettingsForm key={group.key} group={group} /></DashboardWorkspace>;
}
