import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardWorkspace } from "@/components/business/dashboard/DashboardWorkspace";
import { OptionSettings } from "@/components/business/dashboard/settings/options/OptionSettings";
import { findOptionGroup } from "@/components/business/dashboard/settings/options/option-groups";

type SettingsRouteProps = { params: Promise<{ group: string }> };

/** 静态元数据只读取已支持的配置目录，不在 RSC 获取敏感配置。 */
export async function generateMetadata({ params }: SettingsRouteProps): Promise<Metadata> {
  const { group } = await params;
  return { title: `${findOptionGroup(group)?.title ?? "设置"} · 设置` };
}

/** 路由编排真实的客户端表单，未知配置入口返回 404。 */
export default async function OptionSettingsPage({ params }: SettingsRouteProps) {
  const { group: slug } = await params;
  const group = findOptionGroup(slug);
  if (!group) notFound();
  return <DashboardWorkspace><OptionSettings key={group.key} group={group} /></DashboardWorkspace>;
}
