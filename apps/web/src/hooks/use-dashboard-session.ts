"use client";

import useSWR from "swr";
import { DASHBOARD_SESSION_KEY, getDashboardSession } from "@/lib/dashboard-api";

/** 所有后台页面共享一份可焦点重验的 Cookie 会话。 */
export function useDashboardSession() {
  return useSWR(DASHBOARD_SESSION_KEY, getDashboardSession, { shouldRetryOnError: false });
}
