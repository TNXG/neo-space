import { integrationGroups } from "./settings-groups-integration";
import { siteGroups } from "./settings-groups-site";
import type { SettingGroup } from "./settings-schema";

/** 导航、路由和页面共用同一注册表；未知 slug 交由路由返回 404。 */
export const settingGroups: readonly SettingGroup[] = [...siteGroups, ...integrationGroups];

/** 按 URL slug 查找设置分组。 */
export function findSettingGroup(slug: string): SettingGroup | undefined {
  return settingGroups.find(group => group.slug === slug);
}
