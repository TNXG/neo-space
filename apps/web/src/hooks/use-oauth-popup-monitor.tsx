"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOAuthStore } from "@/stores/oauth-store";

/**
 * OAuth 弹窗监听 Hook
 *
 * 监听 OAuth 弹窗的关闭状态，当弹窗关闭但没有收到登录回调时，
 * 自动清除 loading 状态并显示提示
 */
export function useOAuthPopupMonitor() {
  const { isLoading, popup, endLogin } = useOAuthStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 只有在 loading 且有 popup 时才启动监听
    if (!isLoading || !popup) {
      return;
    }

    intervalRef.current = setInterval(() => {
      if (popup.closed) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // 延迟检查状态，确保 messageReceived 已更新
        checkTimerRef.current = setTimeout(() => {
          const currentState = useOAuthStore.getState();

          // 如果还在 loading 且没收到消息，说明用户取消了登录
          if (currentState.isLoading && !currentState.messageReceived) {
            toast.info("登录已取消");
            endLogin();
          }
        }, 100);
      }
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [isLoading, popup, endLogin]);
}
