"use client";

import { useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL, getCurrentUser } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

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
  const { setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 处理 OAuth 登录（弹窗方式）
   */
  const handleOAuthLogin = async (provider: "github" | "qq") => {
    setIsLoading(true);

    try {
      // 1. 打开 OAuth 授权弹窗
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        `${API_BASE_URL}/auth/oauth/${provider}`,
        "oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`,
      );

      if (!popup) {
        toast.error("无法打开登录窗口，请检查浏览器弹窗设置");
        setIsLoading(false);
        return;
      }

      // 2. 监听来自弹窗的消息
      const handleMessage = async (event: MessageEvent) => {
        // 安全检查：确保消息来自我们的域
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === "oauth_success" && event.data.token) {
          try {
            // 3. 获取用户信息
            const response = await getCurrentUser(event.data.token);

            if (response.code === 200 && response.data) {
              // 保存认证信息
              setAuth(response.data, event.data.token);

              // 显示欢迎消息
              if (event.data.isNewUser) {
                if (event.data.bound) {
                  toast.success(`欢迎，${response.data.name}！已成功绑定历史评论`);
                } else {
                  toast.success(`欢迎，${response.data.name}！`);
                }
              } else {
                toast.success(`欢迎回来，${response.data.name}！`);
              }
            } else {
              console.error("[OAuth] 用户信息响应异常:", response);
              throw new Error(response.message || "获取用户信息失败");
            }
          } catch (error) {
            console.error("[OAuth] 错误:", error);
            console.error("OAuth login error:", error);
            toast.error(error instanceof Error ? error.message : "登录失败");
          } finally {
            setIsLoading(false);
            window.removeEventListener("message", handleMessage);
          }
        } else if (event.data.type === "oauth_error") {
          toast.error(event.data.message || "登录失败");
          setIsLoading(false);
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);

      // 5. 监听弹窗关闭（用户手动关闭）
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsLoading(false);
          window.removeEventListener("message", handleMessage);
        }
      }, 500);
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error("登录失败，请重试");
      setIsLoading(false);
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
          aria-label="使用 GitHub 登录"
        >
          {isLoading
            ? (
                <div className="size-4 animate-spin rounded-full border-2 border-primary-50 border-t-transparent" />
              )
            : (
                <span className="iconify size-4" data-icon="mingcute:github-line" />
              )}
          <span>GitHub</span>
        </button>

        <button
          type="button"
          onClick={handleQQLogin}
          disabled={isLoading}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm text-white transition-all hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 border border-accent-500"
          aria-label="使用 QQ 登录"
        >
          {isLoading
            ? (
                <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )
            : (
                <span className="iconify size-4" data-icon="mingcute:qq-line" />
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
        aria-label="使用 GitHub 登录"
      >
        {isLoading
          ? (
              <div className="size-5 animate-spin rounded-full border-2 border-primary-50 border-t-transparent" />
            )
          : (
              <span className="iconify size-5" data-icon="mingcute:github-line" />
            )}
        <span className="font-medium">
          {isLoading ? "登录中..." : "使用 GitHub 登录"}
        </span>
      </button>

      <button
        type="button"
        onClick={handleQQLogin}
        disabled={isLoading}
        className="flex cursor-pointer items-center justify-center gap-3 rounded-xl bg-accent-600 px-6 py-3 text-white transition-all hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 border border-accent-500"
        aria-label="使用 QQ 登录"
      >
        {isLoading
          ? (
              <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )
          : (
              <span className="iconify size-5" data-icon="mingcute:qq-line" />
            )}
        <span className="font-medium">
          {isLoading ? "登录中..." : "使用 QQ 登录"}
        </span>
      </button>
    </div>
  );
}
