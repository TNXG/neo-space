"use client";

import type { ApiResponse, Reader } from "@/types/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { finishDashboardPasskey, startDashboardPasskey } from "@/lib/dashboard-api";
import { authenticateDashboardPasskey, cancelDashboardPasskey, getDashboardPasskeyError, isDashboardPasskeyCancellation } from "@/utils/auth/client";

/** 自动凭据请求与密码表单独立；取消旧挑战后忽略迟到结果。 */
export function useDashboardPasskey(enabled: boolean, onAuthenticated: (user: Reader) => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const finishing = useRef<Promise<ApiResponse<Reader | null>> | null>(null);
  const controller = useRef<AbortController | null>(null);

  /** 取消浏览器请求；若已提交验签，等待其写会话完成，避免两种方式覆盖 Cookie。 */
  const cancel = useCallback(async () => {
    generation.current += 1;
    controller.current?.abort();
    cancelDashboardPasskey();
    setPending(false);
    setError("");
    await finishing.current?.catch(() => undefined);
  }, []);

  /** 自动使用条件式填充，手动点击使用系统验证器；均不要求先填写账号。 */
  const start = useCallback(async (identifier = "", automatic = false) => {
    if (!enabled) return;
    const cancellation = cancel();
    const current = generation.current;
    await cancellation;
    if (current !== generation.current) return;
    const requestController = new AbortController();
    controller.current = requestController;
    setPending(true);
    setError("");
    try {
      const challenge = await startDashboardPasskey(identifier);
      if (current !== generation.current) return;
      if (challenge.status !== "success" || !challenge.data) {
        setError(challenge.message || "无法创建 Passkey 请求。");
        return;
      }
      const credential = await authenticateDashboardPasskey(challenge.data, automatic, requestController.signal);
      if (current !== generation.current) return;
      const request = finishDashboardPasskey(challenge.data.challengeId, credential);
      finishing.current = request;
      const result = await request;
      if (finishing.current === request) finishing.current = null;
      if (current !== generation.current) return;
      if (result.status === "success" && result.data) onAuthenticated(result.data);
      else setError(result.message || "Passkey 验证失败。");
    } catch (cause) {
      if (current === generation.current && !(automatic && isDashboardPasskeyCancellation(cause))) {
        setError(getDashboardPasskeyError(cause));
      }
    } finally {
      if (current === generation.current) setPending(false);
    }
  }, [enabled, cancel, onAuthenticated]);

  useEffect(() => {
    if (enabled) void start("", true);
    return () => { void cancel(); };
  }, [enabled, start, cancel]);

  return { pending, error, start, cancel };
}
