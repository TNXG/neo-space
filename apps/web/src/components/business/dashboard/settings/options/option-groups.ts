import { communicationOptionGroups } from "./communication-options";
import { integrationOptionGroups } from "./integration-options";
import { siteOptionGroups } from "./site-options";

/** 仅开放后端允许维护的十个配置分组，与页面路由共用同一来源。 */
export const optionGroups = [...siteOptionGroups, ...communicationOptionGroups, ...integrationOptionGroups];

/** 未知 URL 不建立空表单，交由路由返回 404。 */
export const findOptionGroup = (slug: string) => optionGroups.find(group => group.slug === slug);
