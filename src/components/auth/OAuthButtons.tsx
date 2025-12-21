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
					className="flex cursor-pointer items-center gap-2 rounded-full bg-[#24292e] px-4 py-2 text-sm text-white transition-colors hover:bg-[#1b1f23] disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="使用 GitHub 登录"
				>
					{isLoading
						? (
								<div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
							)
						: (
								<svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
								</svg>
							)}
					<span>GitHub</span>
				</button>

				<button
					type="button"
					onClick={handleQQLogin}
					disabled={isLoading}
					className="flex cursor-pointer items-center gap-2 rounded-full bg-[#12b7f5] px-4 py-2 text-sm text-white transition-colors hover:bg-[#0ea8e0] disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="使用 QQ 登录"
				>
					{isLoading
						? (
								<div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
							)
						: (
								<svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a38.97 38.97 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673z" />
								</svg>
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
				className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[#24292e] px-6 py-3 text-white transition-colors hover:bg-[#1b1f23] disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="使用 GitHub 登录"
			>
				{isLoading
					? (
							<div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
						)
					: (
							<svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
						)}
				<span className="font-medium">
					{isLoading ? "登录中..." : "使用 GitHub 登录"}
				</span>
			</button>

			<button
				type="button"
				onClick={handleQQLogin}
				disabled={isLoading}
				className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[#12b7f5] px-6 py-3 text-white transition-colors hover:bg-[#0ea8e0] disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="使用 QQ 登录"
			>
				{isLoading
					? (
							<div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
						)
					: (
							<svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
								<path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a38.97 38.97 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673z" />
							</svg>
						)}
				<span className="font-medium">
					{isLoading ? "登录中..." : "使用 QQ 登录"}
				</span>
			</button>
		</div>
	);
}
