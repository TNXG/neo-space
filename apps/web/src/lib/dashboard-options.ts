import type { DashboardOptions, ManagedOptionKey, OptionDocument } from "@/types/api";
import { dashboardRequest } from "./dashboard-api";

export const DASHBOARD_OPTIONS_KEY = "dashboard-options";

/** Owner 配置只放在 SWR 内存缓存，不经过公共站缓存或浏览器持久化。 */
export async function getDashboardOptions(): Promise<DashboardOptions> {
  const options = await dashboardRequest<DashboardOptions>("/options");
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("后端返回的设置集合格式不正确。");
  return options;
}

/** 独立回读一个配置分组，确认环境变量覆盖后的实际值。 */
export async function getDashboardOption(key: ManagedOptionKey): Promise<OptionDocument> {
  return dashboardRequest<OptionDocument>(`/options/${encodeURIComponent(key)}`);
}

/** 完整替换当前分组；保留读取到的未知字段，并支持真正删除数组条目。 */
export async function saveDashboardOption(key: ManagedOptionKey, value: OptionDocument): Promise<OptionDocument> {
  return dashboardRequest<OptionDocument>(`/options/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify(value) });
}
