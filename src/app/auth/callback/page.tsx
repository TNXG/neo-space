/* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
"use client";

import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { bindAnonymousIdentity, skipBind } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const transition = { type: "spring", stiffness: 300, damping: 30 } as const;

const variants = {
	initial: { opacity: 0, scale: 0.95, y: 10, filter: "blur(4px)" },
	animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
	exit: { opacity: 0, scale: 0.95, y: -10, filter: "blur(4px)" },
};

function Background() {
	return (
		<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
			<div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-200/20 rounded-full blur-[100px] mix-blend-multiply opacity-50 animate-pulse-ring" />
			<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-300/20 rounded-full blur-[100px] mix-blend-multiply opacity-50 animate-pulse-ring-delayed" />
			<div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />
		</div>
	);
}

function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const [status, setStatus] = useState<"processing" | "bind" | "success" | "error">("processing");
	const [message, setMessage] = useState("正在建立安全连接...");
	const [token, setToken] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [isBinding, setIsBinding] = useState(false);
	const [isSkipping, setIsSkipping] = useState(false);
	const [skipBindingAllowed, setSkipBindingAllowed] = useState(true);

	// 以此防止 React 18 开发环境下的 useEffect 运行两次
	const processedRef = useRef(false);

	// 修复点 2: 移除 useCallback，将逻辑直接写入 useEffect，并处理好依赖
	useEffect(() => {
		if (processedRef.current)
			return;
		processedRef.current = true;

		// 定义内部异步函数或直接执行逻辑
		const processAuth = () => {
			const timers: NodeJS.Timeout[] = [];

			try {
				const errorParam = searchParams.get("error");
				if (errorParam) {
					const errorMessage = decodeURIComponent(errorParam);
					setStatus("error");
					setMessage(errorMessage);
					if (window.opener) {
						window.opener.postMessage({ type: "oauth_error", message: errorMessage }, window.location.origin);
					}
					const timer = setTimeout(() => window.close(), 3000);
					timers.push(timer);
					return;
				}

				const tokenParam = searchParams.get("token");
				const isNewUser = searchParams.get("new_user") === "true";

				if (!tokenParam)
					throw new Error("未找到认证令牌");

				setToken(tokenParam);
				setSkipBindingAllowed(true);

				if (isNewUser) {
					// 使用 setTimeout 可以让 setState 移出当前的同步执行栈
					// 这有助于解决某些严格的 ESLint 规则抱怨直接 setState
					const timer = setTimeout(() => {
						setStatus("bind");
						setMessage("完善您的身份");
					}, 500);
					timers.push(timer);
				} else {
					setStatus("success");
					setMessage("登录成功");
					if (window.opener) {
						window.opener.postMessage(
							{ type: "oauth_success", token: tokenParam, isNewUser: false },
							window.location.origin,
						);
					}
					const timer = setTimeout(() => window.close(), 1500);
					timers.push(timer);
				}
			} catch (err) {
				console.error("OAuth callback error:", err);
				const errorMessage = err instanceof Error ? err.message : "登录失败";
				setStatus("error");
				setMessage(errorMessage);
				if (window.opener) {
					window.opener.postMessage({ type: "oauth_error", message: errorMessage }, window.location.origin);
				}
				const timer = setTimeout(() => window.close(), 3000);
				timers.push(timer);
			}

			return () => {
				timers.forEach(timer => clearTimeout(timer));
			};
		};

		const cleanup = processAuth();
		return cleanup;
	}, [searchParams]); // 仅依赖 searchParams

	const handleBind = async () => {
		if (!token)
			return toast.error("Token 丢失");
		if (!name.trim() || !email.trim())
			return toast.error("请输入昵称和邮箱");

		const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
		if (!emailRegex.test(email))
			return toast.error("请输入有效的邮箱地址");

		setIsBinding(true);
		try {
			const response = await bindAnonymousIdentity({ name, email }, token);
			if (response.code === 200) {
				toast.success("绑定成功");
				setStatus("success");
				setMessage("身份绑定完成");
				if (window.opener) {
					window.opener.postMessage(
						{ type: "oauth_success", token: response.message, isNewUser: true, bound: true },
						window.location.origin,
					);
				}
				const timer = setTimeout(() => window.close(), 1500);
				return () => clearTimeout(timer);
			} else {
				toast.error(response.message || "绑定失败");
			}
		} catch (error) {
			console.error("Bind error:", error);
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
			const response = await skipBind(token);
			if (response.code === 200) {
				setStatus("success");
				setMessage("注册成功");
				if (window.opener) {
					window.opener.postMessage(
						{ type: "oauth_success", token: response.message, isNewUser: true, bound: false },
						window.location.origin,
					);
				}
				const timer = setTimeout(() => window.close(), 1500);
				return () => clearTimeout(timer);
			} else {
				toast.error(response.message || "注册失败");
				setIsSkipping(false);
			}
		} catch (error) {
			console.error("Skip error:", error);
			toast.error("注册失败，请稍后重试");
			setIsSkipping(false);
		}
	};

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center p-4 selection:bg-accent-200 selection:text-accent-900">
			<Background />

			<motion.div
				layout
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, type: "spring" }}
				className={cn(
					"glass-card w-full max-w-[420px] overflow-hidden shadow-glass relative",
					"bg-card text-card-foreground border-border/50",
				)}
			>
				{/* 顶部装饰条 */}
				<div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-accent-300 via-accent-500 to-accent-300 opacity-50" />

				<div className="p-8 md:p-10">
					<AnimatePresence mode="wait" initial={false}>
						{/* 状态 1: Processing */}
						{status === "processing" && (
							<motion.div
								key="processing"
								variants={variants} // 使用提取出的 variants
								initial="initial"
								animate="animate"
								exit="exit"
								transition={transition} // 使用修复后的 transition
								className="flex flex-col items-center justify-center py-8"
							>
								<div className="relative mb-8">
									<div className="absolute inset-0 rounded-full blur-md bg-accent-400/30 animate-pulse" />
									<Icon
										icon="mingcute:loading-3-line"
										className="relative w-12 h-12 text-accent-600 animate-spin"
									/>
								</div>
								<h2 className="text-xl font-semibold text-foreground tracking-tight">{message}</h2>
								<p className="mt-2 text-sm text-muted-foreground">请稍候，正在验证您的信息</p>
							</motion.div>
						)}

						{/* 状态 2: Bind Form */}
						{status === "bind" && (
							<motion.div
								key="bind"
								variants={variants}
								initial="initial"
								animate="animate"
								exit="exit"
								transition={transition}
								className="flex flex-col"
							>
								{/* ... 表单内容保持不变 ... */}
								<div className="text-center mb-8">
									<div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-50 text-accent-600 mb-4 ring-1 ring-accent-100">
										<Icon icon="mingcute:user-add-2-line" className="w-6 h-6" />
									</div>
									<h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">
										关联匿名身份
									</h2>
									<p className="text-sm text-muted-foreground leading-relaxed px-2">
										如果您曾在本站以匿名身份发表过评论，请输入当时使用的昵称和邮箱进行关联。
									</p>
								</div>

								<form className="space-y-4" onSubmit={e => e.preventDefault()}>
									<div className="space-y-4">
										{/* 昵称输入框 */}
										<div className="group relative">
											<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent-600">
												<Icon icon="mingcute:user-3-line" className="w-5 h-5" />
											</div>
											<input
												type="text"
												value={name}
												onChange={e => setName(e.target.value)}
												placeholder="匿名昵称"
												disabled={isBinding}
												className="w-full h-11 pl-11 pr-4 rounded-xl bg-secondary/30 border border-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:bg-background focus:border-accent-300 focus:ring-4 focus:ring-accent-100/50 outline-none transition-all duration-200"
											/>
										</div>

										{/* 邮箱输入框 */}
										<div className="group relative">
											<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent-600">
												<Icon icon="mingcute:mail-line" className="w-5 h-5" />
											</div>
											<input
												type="email"
												value={email}
												onChange={e => setEmail(e.target.value)}
												placeholder="匿名邮箱"
												disabled={isBinding}
												className="w-full h-11 pl-11 pr-4 rounded-xl bg-secondary/30 border border-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:bg-background focus:border-accent-300 focus:ring-4 focus:ring-accent-100/50 outline-none transition-all duration-200"
											/>
										</div>
									</div>

									<div className="py-2">
										<div className="flex gap-3 text-xs text-amber-600/90 bg-amber-50/50 px-3 py-2.5 rounded-lg border border-amber-100/50">
											<Icon icon="mingcute:information-line" className="w-4 h-4 shrink-0 mt-0.5" />
											<span>必须与之前的匿名评论完全一致才能绑定成功。</span>
										</div>
									</div>

									<div className="flex gap-3 mt-2">
										{skipBindingAllowed && (
											<button
												type="button"
												onClick={handleSkip}
												disabled={isBinding || isSkipping}
												className="flex-1 h-11 inline-flex items-center justify-center rounded-xl border border-border bg-transparent text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:border-accent-200 focus:ring-2 focus:ring-offset-1 focus:ring-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
											>
												{isSkipping
													? (
															<Icon icon="mingcute:loading-line" className="animate-spin w-4 h-4" />
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
											className={cn(
												"h-11 inline-flex items-center justify-center rounded-xl bg-accent-600 text-white text-sm font-semibold shadow-lg shadow-accent-600/20 hover:bg-accent-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed",
												skipBindingAllowed ? "flex-1" : "w-full",
											)}
										>
											{isBinding
												? (
														<span className="flex items-center gap-2">
															<Icon icon="mingcute:loading-line" className="animate-spin w-4 h-4" />
															绑定中...
														</span>
													)
												: (
														"确认关联"
													)}
										</button>
									</div>
								</form>
							</motion.div>
						)}

						{/* 状态 3: Success */}
						{status === "success" && (
							<motion.div
								key="success"
								variants={variants}
								initial="initial"
								animate="animate"
								exit="exit"
								transition={transition}
								className="flex flex-col items-center justify-center py-6"
							>
								<motion.div
									initial={{ scale: 0, rotate: -45 }}
									animate={{ scale: 1, rotate: 0 }}
									transition={{ type: "spring", duration: 0.6, bounce: 0.5 }}
									className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 ring-8 ring-emerald-50"
								>
									<Icon icon="mingcute:check-fill" className="w-10 h-10" />
								</motion.div>
								<h2 className="text-xl font-bold text-foreground">{message}</h2>
								<p className="mt-2 text-sm text-muted-foreground">窗口即将自动关闭...</p>
							</motion.div>
						)}

						{/* 状态 4: Error */}
						{status === "error" && (
							<motion.div
								key="error"
								variants={variants}
								initial="initial"
								animate="animate"
								exit="exit"
								transition={transition}
								className="flex flex-col items-center justify-center py-4"
							>
								<div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-6">
									<Icon icon="mingcute:close-line" className="w-8 h-8" />
								</div>
								<h2 className="text-lg font-bold text-destructive">认证失败</h2>
								<p className="mt-2 text-sm text-muted-foreground text-center max-w-[280px]">
									{message}
								</p>
								<button
									type="button"
									onClick={() => window.close()}
									className="mt-8 px-6 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
								>
									关闭窗口
								</button>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</motion.div>
		</div>
	);
}

export default function AuthCallbackPage() {
	return (
		<Suspense fallback={(
			<div className="relative flex min-h-screen flex-col items-center justify-center p-4">
				<div className="flex flex-col items-center justify-center py-8">
					<div className="relative mb-8">
						<div className="absolute inset-0 rounded-full blur-md bg-accent-400/30 animate-pulse" />
						<Icon
							icon="mingcute:loading-3-line"
							className="relative w-12 h-12 text-accent-600 animate-spin"
						/>
					</div>
					<h2 className="text-xl font-semibold text-foreground tracking-tight">加载中...</h2>
				</div>
			</div>
		)}
		>
			<AuthCallbackContent />
		</Suspense>
	);
}
