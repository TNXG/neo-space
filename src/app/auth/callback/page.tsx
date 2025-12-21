"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { bindAnonymousIdentity, skipBind } from "@/lib/api-client";

/**
 * OAuth 回调处理页面（在弹窗中打开）
 *
 * 支持两种模式：
 * 1. OAuth 登录模式：从 URL 参数中读取 token 和 new_user
 * 2. 绑定模式：从 URL 参数中读取 bind_mode=true 和 token，直接显示绑定表单
 *
 * 流程：
 * 1. 如果是新用户，显示绑定表单
 * 2. 如果是老用户，通过 postMessage 通知父窗口并关闭
 */
export default function AuthCallbackPage() {
	const searchParams = useSearchParams();
	const [status, setStatus] = useState<"processing" | "bind" | "success" | "error">("processing");
	const [message, setMessage] = useState("正在处理登录...");
	const [token, setToken] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [isBinding, setIsBinding] = useState(false);
	const [isSkipping, setIsSkipping] = useState(false);
	const [isBindMode, setIsBindMode] = useState(false); // 是否是绑定模式
	const [skipBindingAllowed, setSkipBindingAllowed] = useState(true); // 绑定模式下不允许跳过
	const processedRef = useRef(false);

	const handleCallback = useCallback(() => {
		// 防止重复处理
		if (processedRef.current)
			return;
		processedRef.current = true;

		try {
			// 检查是否是绑定模式
			const bindModeParam = searchParams.get("bind_mode");
			if (bindModeParam === "true") {
				// 绑定模式：已登录用户想要绑定匿名身份
				const tokenParam = searchParams.get("token");
				if (!tokenParam) {
					throw new Error("未找到认证令牌");
				}

				setToken(tokenParam);
				setIsBindMode(true);
				setSkipBindingAllowed(false); // 绑定模式下不允许跳过
				setStatus("bind");
				setMessage("绑定匿名身份");
				return;
			}

			// OAuth 登录模式
			// 检查是否有错误参数
			const errorParam = searchParams.get("error");
			if (errorParam) {
				const errorMessage = decodeURIComponent(errorParam);
				setStatus("error");
				setMessage(errorMessage);

				// 通知父窗口登录失败
				if (window.opener) {
					window.opener.postMessage(
						{
							type: "oauth_error",
							message: errorMessage,
						},
						window.location.origin,
					);
				}

				// 3秒后关闭窗口
				const timer = setTimeout(() => window.close(), 3000);
				return () => clearTimeout(timer);
			}

			// 从 URL 参数中读取 token 和 new_user
			const tokenParam = searchParams.get("token");
			const isNewUser = searchParams.get("new_user") === "true";

			if (!tokenParam) {
				throw new Error("未找到认证令牌");
			}

			setToken(tokenParam);
			setSkipBindingAllowed(true); // OAuth 登录模式允许跳过

			if (isNewUser) {
				// 新用户：显示绑定表单
				setStatus("bind");
				setMessage("欢迎！");
			} else {
				// 老用户：通知父窗口并关闭
				setStatus("success");
				setMessage("登录成功！");

				if (window.opener) {
					window.opener.postMessage(
						{
							type: "oauth_success",
							token: tokenParam,
							isNewUser: false,
						},
						window.location.origin,
					);
				}

				const timer = setTimeout(() => window.close(), 1000);
				return () => clearTimeout(timer);
			}
		} catch (err) {
			console.error("OAuth callback error:", err);
			const errorMessage = err instanceof Error ? err.message : "登录失败";
			setStatus("error");
			setMessage(errorMessage);

			// 通知父窗口登录失败
			if (window.opener) {
				window.opener.postMessage(
					{
						type: "oauth_error",
						message: errorMessage,
					},
					window.location.origin,
				);
			}

			// 3秒后关闭窗口
			const timer = setTimeout(() => window.close(), 3000);
			return () => clearTimeout(timer);
		}
	}, [searchParams]);

	useEffect(() => {
		handleCallback();
	}, [handleCallback]);

	const handleBind = async () => {
		if (!token) {
			toast.error("Token 丢失");
			return;
		}

		// 绑定模式：不需要输入 name 和 email，后端从 token 获取
		if (isBindMode) {
			setIsBinding(true);

			try {
				// 不传递 name 和 email，后端会从当前 Reader 获取
				const response = await bindAnonymousIdentity({}, token);

				if (response.code === 200) {
					const newToken = response.message;

					toast.success("绑定成功！");
					setStatus("success");
					setMessage("绑定成功！");

					// 通知父窗口
					if (window.opener) {
						window.opener.postMessage(
							{
								type: "bind_success",
								token: newToken,
							},
							window.location.origin,
						);
					}

					setTimeout(() => window.close(), 1000);
				} else {
					toast.error(response.message || "绑定失败");
				}
			} catch (error) {
				console.error("Bind anonymous identity error:", error);
				toast.error("绑定失败，请稍后重试");
			} finally {
				setIsBinding(false);
			}
			return;
		}

		// OAuth 登录模式：需要输入 name 和 email
		if (!name.trim() || !email.trim()) {
			toast.error("请输入昵称和邮箱");
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			toast.error("请输入有效的邮箱地址");
			return;
		}

		setIsBinding(true);

		try {
			const response = await bindAnonymousIdentity({ name, email }, token);

			if (response.code === 200) {
				// response.message 中包含新的 JWT token
				const newToken = response.message;

				toast.success("绑定成功！");
				setStatus("success");
				setMessage("绑定成功！");

				// 通知父窗口（使用新 token）
				if (window.opener) {
					window.opener.postMessage(
						{
							type: "oauth_success",
							token: newToken, // 使用新 token
							isNewUser: true,
							bound: true,
						},
						window.location.origin,
					);
				}

				setTimeout(() => window.close(), 1000);
			} else {
				toast.error(response.message || "绑定失败");
			}
		} catch (error) {
			console.error("Bind anonymous identity error:", error);
			toast.error("绑定失败，请稍后重试");
		} finally {
			setIsBinding(false);
		}
	};

	const handleSkip = async () => {
		if (!token)
			return;

		setIsSkipping(true);

		try {
			// 调用 skip-bind API 创建 Reader
			const response = await skipBind(token);

			if (response.code === 200) {
				// response.message 中包含新的 JWT token
				const newToken = response.message;

				// 通知父窗口（跳过绑定，使用新 token）
				if (window.opener) {
					window.opener.postMessage(
						{
							type: "oauth_success",
							token: newToken,
							isNewUser: true,
							bound: false,
						},
						window.location.origin,
					);
				}

				setStatus("success");
				setMessage("注册成功！");
				setTimeout(() => window.close(), 1000);
			} else {
				toast.error(response.message || "注册失败");
				setIsSkipping(false);
			}
		} catch (error) {
			console.error("Skip bind error:", error);
			toast.error("注册失败，请稍后重试");
			setIsSkipping(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
			<div className="max-w-md rounded-2xl bg-white p-8 shadow-xl">
				{status === "processing" && (
					<div className="text-center">
						<div className="mb-4 animate-spin text-6xl">⏳</div>
						<h1 className="mb-2 text-2xl font-bold text-gray-800">{message}</h1>
						<p className="text-gray-600">请稍候...</p>
					</div>
				)}

				{status === "bind" && (
					<div>
						<div className="mb-4 text-center">
							<div className="mb-2 text-4xl">🎉</div>
							<h1 className="mb-2 text-2xl font-bold text-gray-800">{message}</h1>
							<p className="text-sm text-gray-600">
								{isBindMode
									? "将您之前的匿名评论关联到当前账号"
									: "如果您之前以匿名身份发表过评论，可以在此绑定"}
							</p>
						</div>

						{/* 绑定模式：不显示输入框 */}
						{!isBindMode && (
							<div className="mb-4 space-y-3">
								<div>
									<label htmlFor="bind-name" className="mb-1 block text-sm font-medium text-gray-700">
										匿名昵称
									</label>
									<input
										id="bind-name"
										type="text"
										value={name}
										onChange={e => setName(e.target.value)}
										placeholder="请输入之前使用的昵称"
										className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
										disabled={isBinding}
									/>
								</div>

								<div>
									<label htmlFor="bind-email" className="mb-1 block text-sm font-medium text-gray-700">
										匿名邮箱
									</label>
									<input
										id="bind-email"
										type="email"
										value={email}
										onChange={e => setEmail(e.target.value)}
										placeholder="请输入之前使用的邮箱"
										className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
										disabled={isBinding}
									/>
								</div>
							</div>
						)}

						{!isBindMode && (
							<p className="mb-4 text-xs text-gray-500">
								💡 提示：昵称和邮箱必须与之前的匿名评论完全一致才能绑定成功
							</p>
						)}

						{isBindMode && (
							<p className="mb-4 text-xs text-gray-500">
								💡 提示：系统将使用您当前账号的昵称和邮箱查找匹配的匿名评论
							</p>
						)}

						<div className="flex gap-3">
							{skipBindingAllowed && (
								<button
									type="button"
									onClick={handleSkip}
									disabled={isBinding || isSkipping}
									className="flex-1 cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{isSkipping
										? (
												<span className="flex items-center justify-center gap-2">
													<div className="size-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
													注册中...
												</span>
											)
										: (
												"跳过"
											)}
								</button>
							)}
							<button
								type="button"
								onClick={handleBind}
								disabled={isBinding || isSkipping}
								className={`${skipBindingAllowed ? "flex-1" : "w-full"} cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50`}
							>
								{isBinding
									? (
											<span className="flex items-center justify-center gap-2">
												<div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
												绑定中...
											</span>
										)
									: (
											"确认绑定"
										)}
							</button>
						</div>
					</div>
				)}

				{status === "success" && (
					<div className="text-center">
						<div className="mb-4 text-6xl">✅</div>
						<h1 className="mb-2 text-2xl font-bold text-green-600">{message}</h1>
						<p className="text-gray-600">窗口即将关闭...</p>
					</div>
				)}

				{status === "error" && (
					<div className="text-center">
						<div className="mb-4 text-6xl">❌</div>
						<h1 className="mb-2 text-2xl font-bold text-red-600">登录失败</h1>
						<p className="mb-4 text-gray-600">{message}</p>
						<button
							type="button"
							onClick={() => window.close()}
							className="cursor-pointer rounded-full bg-gray-800 px-6 py-2 text-white transition-colors hover:bg-gray-700"
						>
							关闭窗口
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
