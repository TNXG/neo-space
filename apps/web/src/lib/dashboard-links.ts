import type { DashboardLinkInput, Link, LinkStateCount, LinkStateType, PaginatedData } from "@/types/api";
import { dashboardRequest } from "./dashboard-api";

export const DASHBOARD_LINK_COUNT_KEY = "dashboard-link-count";

/** 友链列表缓存键：包含状态与页码。 */
export const dashboardLinksKey = (state: LinkStateType, page: number) => ["dashboard-links", state, page] as const;

/** 判断 SWR key 是否属于友链列表，用于写入后统一失效。 */
export const isDashboardLinksKey = (key: unknown) => Array.isArray(key) && key[0] === "dashboard-links";

/**
 * 按状态分页读取友链（含健康与订阅缓存）。
 * @param state 友链状态
 * @param page 页码
 * @returns 分页友链
 */
export function getDashboardLinks(state: LinkStateType, page: number): Promise<PaginatedData<Link>> {
  return dashboardRequest<PaginatedData<Link>>(`/links/admin?state=${state}&page=${page}&size=50`);
}

/** 各状态数量，用于标签页计数与待审核提醒。 */
export function getDashboardLinkCount(): Promise<LinkStateCount> {
  return dashboardRequest<LinkStateCount>("/links/state");
}

export function createDashboardLink(input: DashboardLinkInput): Promise<Link> {
  return dashboardRequest<Link>("/links", { method: "POST", body: JSON.stringify(input) });
}

export function updateDashboardLink(_id: string, input: Partial<DashboardLinkInput>): Promise<Link> {
  return dashboardRequest<Link>(`/links/${encodeURIComponent(_id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteDashboardLink(_id: string): Promise<unknown> {
  return dashboardRequest<unknown>(`/links/${encodeURIComponent(_id)}`, { method: "DELETE" });
}

/** 立即重新检查单个友链的站点与订阅源；外部站点可能较慢，放宽超时。 */
export function recheckDashboardLink(_id: string): Promise<Link> {
  return dashboardRequest<Link>(`/links/${encodeURIComponent(_id)}/health`, { method: "POST", timeout: 60000 });
}

/** 重新检查全部已通过友链。 */
export function recheckAllDashboardLinks(): Promise<Record<string, Link>> {
  return dashboardRequest<Record<string, Link>>("/links/health", { timeout: 180000 });
}

/** 向友链联系人发送博主撰写的邮件。 */
export function notifyDashboardLink(_id: string, subject: string, content: string): Promise<unknown> {
  return dashboardRequest<unknown>(`/links/${encodeURIComponent(_id)}/notification`, { method: "POST", body: JSON.stringify({ subject, content }) });
}
