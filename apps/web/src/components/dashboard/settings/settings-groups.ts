import { integrationGroups } from "./settings-groups-integration";
import { networkGroup } from "./settings-groups-network";
import { siteGroups } from "./settings-groups-site";
import type { SettingGroup } from "./settings-schema";

/** 后端文档仍独立保存，页面分组只改变信息架构，不改变配置契约。 */
export const settingGroups: readonly SettingGroup[] = [...siteGroups, ...integrationGroups, networkGroup];

export interface SettingPage {
  slug: string;
  title: string;
  icon: string;
  help: string;
  groups: readonly SettingGroup[];
}


/** 将小型配置按使用场景归在同一页，避免单字段独占页面。 */
export const settingPages: readonly SettingPage[] = [
  {
    slug: "site", title: "站点与展示", icon: "mingcute:earth-line",
    help: "管理网站信息、访问地址与追番展示。",
    groups: settingGroups.filter(group => ["seo", "url", "bangumiOptions"].includes(group.key)),
  },
  ...settingGroups.filter(group => ["commentOptions", "friendLinkOptions", "mailOptions", "oauth", "ai"].includes(group.key))
    .map(group => ({ slug: group.slug, title: group.title, icon: group.icon, help: group.help, groups: [group] })),
  {
    slug: "services", title: "服务与安全", icon: "mingcute:server-line",
    help: "管理站内搜索、网络代理与桌面端连接。",
    groups: [integrationGroups.find(group => group.key === "searchOptions")!, networkGroup, integrationGroups.find(group => group.key === "securityOptions")!],
  },
];

/** 路由与导航只暴露面向使用场景的页面。 */
export function findSettingPage(slug: string): SettingPage | undefined {
  return settingPages.find(page => page.slug === slug);
}
