"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL, getCurrentUser } from "@/lib/api-client";
import { Icon } from "@/lib/inline-icon";
import { useAuthStore } from "@/stores/auth-store";
import { useOAuthStore } from "@/stores/oauth-store";

// Static regex patterns to avoid re-compilation
const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

interface OAuthButtonsProps {
  /**
   * 按钮样式变体
   * - default: 默认样式
   * - compact: 紧凑样式（用于评论区等空间有限的地方）
   */
  variant?: "default" | "compact";

  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * OAuth 登录按钮组件
 *
 * 功能：
 * - 提供 GitHub 和 QQ 登录按钮
 * - 使用弹窗方式进行 OAuth 登录，不打断用户当前操作
 * - 通过 postMessage 与弹窗通信
 * - 新用户在弹窗内完成匿名身份绑定
 */
export function OAuthButtons({ variant = "default", className = "" }: OAuthButtonsProps) {
  const t = useTranslations();
  const { setAuth } = useAuthStore();
  const { isLoading, startLogin, markMessageReceived, endLogin, reset } = useOAuthStore();
  /**
   * 监听移动端 OAuth 返回
   */
  useEffect(() => {
    const handleMobileOAuthReturn = async () => {
      const token = localStorage.getItem("oauth_token");
      const isNewUser = localStorage.getItem("oauth_is_new_user") === "true";
      const bound = localStorage.getItem("oauth_bound") === "true";

      if (token) {
        // 清除 localStorage
        localStorage.removeItem("oauth_token");
        localStorage.removeItem("oauth_is_new_user");
        localStorage.removeItem("oauth_bound");

        try {
          // 获取用户信息
          const response = await getCurrentUser(token);

          if (response.code === 200 && response.data) {
            // 保存认证信息
            setAuth(response.data, token);

            // 显示欢迎消息
            if (isNewUser) {
              if (bound) {
                toast.success(t("comment.welcomeWithBound", { name: response.data.name }));
              } else {
                toast.success(t("comment.welcome", { name: response.data.name }));
              }
            } else {
              toast.success(t("comment.welcomeBack", { name: response.data.name }));
            }
          } else {
            console.error("[OAuth] Unexpected user info response:", response);
            throw new Error(response.message || t("comment.fetchUserFailed"));
          }
        } catch (error) {
          console.error("[OAuth] Error:", error);
          toast.error(error instanceof Error ? error.message : t("comment.loginFailed"));
        }
      }
    };

    // 页面加载时检查是否有待处理的 OAuth 返回
    handleMobileOAuthReturn();
  }, [setAuth]);

  /**
   * 处理 OAuth 登录（弹窗方式）
   */
  const handleOAuthLogin = async (provider: "github" | "qq") => {
    try {
      // 检测是否为移动设备
      const isMobile = MOBILE_REGEX.test(navigator.userAgent)
        || window.innerWidth < 768;

      // 移动端：直接跳转，使用 sessionStorage 保存当前页面
      if (isMobile) {
        // 保存当前页面 URL，登录后返回
        sessionStorage.setItem("oauth_return_url", window.location.href);

        // 直接跳转到 OAuth 授权页面
        window.location.href = `${API_BASE_URL}/auth/oauth/${provider}`;
        return;
      }

      // 桌面端：使用弹窗方式
      // 1. 打开 OAuth 授权弹窗
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const newPopup = window.open(
        `${API_BASE_URL}/auth/oauth/${provider}`,
        "oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`,
      );

      if (!newPopup) {
        toast.error(t("comment.oauthPopupBlocked"));
        return;
      }

      // 开始登录流程
      startLogin(newPopup);

      // 2. 监听来自弹窗的消息
      const handleMessage = async (event: MessageEvent) => {
        // 安全检查：确保消息来自我们的域
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === "oauth_success" && event.data.token) {
          markMessageReceived();
          try {
            // 3. 获取用户信息
            const response = await getCurrentUser(event.data.token);

            if (response.code === 200 && response.data) {
              // 保存认证信息
              setAuth(response.data, event.data.token);

              // 显示欢迎消息
              if (event.data.isNewUser) {
                if (event.data.bound) {
                  toast.success(t("comment.welcomeWithBound", { name: response.data.name }));
                } else {
                  toast.success(t("comment.welcome", { name: response.data.name }));
                }
              } else {
                toast.success(t("comment.welcomeBack", { name: response.data.name }));
              }
            } else {
              console.error("[OAuth] Unexpected user info response:", response);
              throw new Error(response.message || t("comment.fetchUserFailed"));
            }
          } catch (error) {
            console.error("[OAuth] Error:", error);
            toast.error(error instanceof Error ? error.message : t("comment.loginFailed"));
          } finally {
            endLogin();
            window.removeEventListener("message", handleMessage);
          }
        } else if (event.data.type === "oauth_error") {
          markMessageReceived();
          toast.error(event.data.message || t("comment.loginFailed"));
          endLogin();
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);

      // 清理函数
      return () => {
        window.removeEventListener("message", handleMessage);
      };
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error(t("comment.loginRetry"));
      reset();
    }
  };

  const handleGitHubLogin = () => handleOAuthLogin("github");
  const handleQQLogin = () => handleOAuthLogin("qq");

  if (variant === "compact") {
    return (
      <div className={`flex gap-2 ${className}`}>
        <button
          type="button"
          onClick={handleGitHubLogin}
          disabled={isLoading}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-800 px-4 py-2 text-sm text-primary-50 transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 border border-primary-700"
          aria-label={t("comment.githubLogin")}
        >
          {isLoading
            ? (
                <div className="size-4 animate-spin rounded-full border-2 border-primary-50 border-t-transparent" />
              )
            : (
                <Icon icon="mingcute:github-line" className="size-4" />
              )}
          <span>GitHub</span>
        </button>

        <button
          type="button"
          onClick={handleQQLogin}
          disabled={isLoading}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm text-white transition-all hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 border border-accent-500"
          aria-label={t("comment.qqLogin")}
        >
          {isLoading
            ? (
                <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )
            : (
                <Icon icon="mingcute:qq-line" className="size-4" />
              )}
          <span>QQ</span>
        </button>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <button
        type="button"
        onClick={handleGitHubLogin}
        disabled={isLoading}
        className="flex cursor-pointer items-center justify-center gap-3 rounded-xl bg-primary-800 px-6 py-3 text-primary-50 transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 border border-primary-700"
        aria-label={t("comment.githubLogin")}
      >
        {isLoading
          ? (
              <div className="size-5 animate-spin rounded-full border-2 border-primary-50 border-t-transparent" />
            )
          : (
              <Icon icon="mingcute:github-line" className="size-5" />
            )}
        <span className="font-medium">
          {isLoading ? t("comment.loggingIn") : t("comment.githubLogin")}
        </span>
      </button>

      <button
        type="button"
        onClick={handleQQLogin}
        disabled={isLoading}
        className="flex cursor-pointer items-center justify-center gap-3 rounded-xl bg-accent-600 px-6 py-3 text-white transition-all hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 border border-accent-500"
        aria-label={t("comment.qqLogin")}
      >
        {isLoading
          ? (
              <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )
          : (
              <Icon icon="mingcute:qq-line" className="size-5" />
            )}
        <span className="font-medium">
          {isLoading ? t("comment.loggingIn") : t("comment.qqLogin")}
        </span>
      </button>
    </div>
  );
}
