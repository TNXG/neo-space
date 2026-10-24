"use client";

import type { ApiResponse, DashboardLoginOptions, DashboardOwnerIdentification, DashboardOwnerProfile, Reader } from "@/types/api";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { loginDashboardWithPassword, DASHBOARD_SESSION_KEY } from "@/lib/dashboard-api";
import { encryptDashboardPassword } from "@/utils/auth/password-transport";
import { getDashboardLoginOptions, identifyDashboardOwner } from "@/lib/api-client";
import { useDashboardPasskey } from "./use-dashboard-passkey";
import { useDashboardSession } from "./use-dashboard-session";

/** 登录面板可观察状态与用户操作。 */
export interface DashboardLoginState {
  identifier: string;
  changeIdentifier: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  user: Reader | null;
  profile: DashboardOwnerProfile | null;
  allow: DashboardLoginOptions | null;
  pending: "password" | null;
  passkeyPending: boolean;
  passkeyError: string;
  error: string;
  queryError: string;
  optionsError: string;
  identifying: boolean;
  unmatched: boolean;
  optionsLoading: boolean;
  retry: () => void;
  signIn: (method: "password" | "passkey") => Promise<void>;
}
/** 管理名称查询、强认证与会话状态；更换名称立即丢弃旧资料和密码。 */
export function useDashboardLogin(initialError = ""): DashboardLoginState {
  const { mutate } = useSWRConfig();
  const [identifier, setIdentifier] = useState("");
  const [query, setQuery] = useState("");
  const [password, setPassword] = useState("");
  const [authenticatedUser, setUser] = useState<Reader | null>(null);
  const session = useDashboardSession();
  const user = authenticatedUser ?? session.data ?? null;
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState<"password" | null>(null);
  const inFlight = useRef(false);

  // 仅合并连续按键的查询，不延迟输入反馈；请求本身由 SWR 管理。
  useEffect(() => {
    const timer = setTimeout(() => setQuery(identifier.trim()), 250);
    return () => clearTimeout(timer);
  }, [identifier]);

  const options = useSWR<ApiResponse<DashboardLoginOptions | null>>(
    user || session.isLoading ? null : "dashboard-login-options", getDashboardLoginOptions,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  const identity = useSWR<ApiResponse<DashboardOwnerIdentification | null>>(
    !user && query && query === identifier.trim() ? ["dashboard-owner", query] : null,
    () => identifyDashboardOwner(query),
    { shouldRetryOnError: false, revalidateOnFocus: false, keepPreviousData: false },
  );
  const identification = query === identifier.trim() && identity.data?.status === "success" ? identity.data.data : null;
  const profile = identification?.matched ? identification.profile : null;
  const allow = options.data?.status === "success" ? options.data.data : null;
  const identifying = Boolean(identifier.trim()) && (query !== identifier.trim() || identity.isLoading);
  const queryError = identity.error ? "无法获取博主信息，请检查后台连接后重试。"
    : identity.data?.status === "failed" ? identity.data.message : "";
  const optionsError = options.error ? "无法获取登录方式，请检查后台连接后重试。"
    : options.data?.status === "failed" ? options.data.message : "";

  /** 两种认证方式成功后进入同一会话状态，不显示账号明细。 */
  const completeSignIn = useCallback((reader: Reader) => {
    setPassword("");
    setError("");
    setUser(reader);
    void mutate(DASHBOARD_SESSION_KEY, reader, { revalidate: false });
  }, [mutate]);
  const passkey = useDashboardPasskey(allow?.passkey === true && !user, completeSignIn);

  /** 更换身份时同步清空敏感输入和旧的认证错误。 */
  const changeIdentifier = (value: string) => {
    setIdentifier(value);
    setPassword("");
    setError("");
  };

  /** 密码提交才占用表单；后台 Passkey 请求不锁住输入或按钮。 */
  const signIn = async (method: "password" | "passkey") => {
    if (inFlight.current || user) return;
    if (method === "passkey") {
      await passkey.start("");
      return;
    }
    if (!profile || !allow?.password || !password) return;
    inFlight.current = true;
    setPending("password");
    setError("");
    try {
      await passkey.cancel();
      const encrypted = await encryptDashboardPassword(password);
      setPassword("");
      const result = await loginDashboardWithPassword(profile.username, encrypted);
      if (result.status !== "success" || !result.data) {
        setError(result.message || "登录失败，请重试。");
        return;
      }
      completeSignIn(result.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录请求失败，请检查后台连接后重试。");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  return {
    identifier, changeIdentifier, password, setPassword, user, profile, allow, pending,
    passkeyPending: passkey.pending, passkeyError: passkey.error,
    error, queryError, optionsError, identifying,
    unmatched: identification?.matched === false,
    optionsLoading: options.isLoading,
    retry: () => { void options.mutate(); void identity.mutate(); },
    signIn,
  };
}
