import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import type { ApiResponse, DashboardEncryptedPassword, DashboardPasskeyChallenge, DashboardProfileUpdate, Reader, User } from "@/types/api";
import { apiClient, ApiClientError } from "./api-client";

export const DASHBOARD_SESSION_KEY = "dashboard-session";
export const DASHBOARD_PROFILE_KEY = "dashboard-profile";

/** 后台浏览器请求直接携带 Rust HttpOnly Cookie；写入带来源校验头。 */
export async function dashboardRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET") headers.set("X-Requested-With", "Neo-Space-Dashboard");
  const result = await apiClient<ApiResponse<T>>(path, { ...options, headers, credentials: "include", cache: "no-store", timeout: 10000, clearReaderAuthOnUnauthorized: false });
  if (result.status !== "success") throw new ApiClientError(result.message, result.code);
  return result.data;
}

/** 匿名或失效会话返回 null，依赖故障保留为错误。 */
export async function getDashboardSession(): Promise<Reader | null> {
  try {
    const reader = await dashboardRequest<Reader>("/auth/tokens");
    if (!reader || !reader.isOwner) throw new ApiClientError("无权访问后台", 403);
    return reader;
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

/** 登录后再次校验 Owner Cookie，不向调用方返回 token。 */
async function finishAuthentication(path: string, body: unknown): Promise<ApiResponse<Reader | null>> {
  await dashboardRequest<unknown>(path, { method: "POST", body: JSON.stringify(body) });
  const user = await getDashboardSession();
  if (!user) throw new Error("会话未建立，请检查后端 Cookie 与跨域部署配置。");
  return { code: 200, status: "success", message: "登录成功", data: user };
}

/** 浏览器只向 Rust 提交加密后的密码。 */
export function loginDashboardWithPassword(identifier: string, encrypted: DashboardEncryptedPassword) {
  return finishAuthentication("/auth/tokens", { identifier, ...encrypted });
}

/** 创建后端 Passkey 挑战。 */
export async function startDashboardPasskey(identifier: string): Promise<ApiResponse<DashboardPasskeyChallenge | null>> {
  const data = await dashboardRequest<DashboardPasskeyChallenge>("/auth/passkeys/authenticate/start", { method: "POST", body: JSON.stringify(identifier ? { identifier } : {}) });
  return { code: 200, status: "success", message: "", data };
}

/** 验签成功后通过真实 Cookie 确认会话。 */
export function finishDashboardPasskey(challengeId: string, credential: AuthenticationResponseJSON) {
  return finishAuthentication("/auth/passkeys/authenticate/finish", { challengeId, credential });
}

/** 由 Rust 清除认证 Cookie。 */
export async function logoutDashboard(): Promise<ApiResponse<null>> {
  await dashboardRequest<null>("/auth/tokens", { method: "DELETE" });
  return { code: 200, status: "success", message: "已退出", data: null };
}

/** 读取公开聚合 Profile；不使用公共站永久缓存。 */
export function getDashboardProfile(): Promise<User> {
  return dashboardRequest<User>("/user/profile");
}

/** 更新当前 Owner 资料，社交字段由表单完整提交。 */
export function updateDashboardProfile(payload: DashboardProfileUpdate): Promise<Reader> {
  return dashboardRequest<Reader>("/user/profile", { method: "PATCH", body: JSON.stringify(payload) });
}
