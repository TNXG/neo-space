"use client";

import type { AccountInfo } from "@/lib/api-client";
import { Icon } from "@iconify/react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL, getUserAccounts } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { AvatarSelector } from "./AvatarSelector";

interface ProfilePopoverProps {
	isOpen: boolean;
	onClose: () => void;
	onAvatarChange?: () => void;
}

/**
 * 个人资料弹窗组件
 *
 * 显示用户信息、关联账号和头像选择器
 */
export function ProfilePopover({ isOpen, onClose, onAvatarChange }: ProfilePopoverProps) {
	const { user: authUser, token, clearAuth, fetchUser } = useAuthStore();
	const [accounts, setAccounts] = useState<AccountInfo[]>([]);
	const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

	/**
	 * 打开绑定匿名身份的小窗口
	 */
	const openBindWindow = () => {
		if (!token) {
			toast.error("未登录");
			return;
		}

		const width = 500;
		const height = 600;
		const left = window.screenX + (window.outerWidth - width) / 2;
		const top = window.screenY + (window.outerHeight - height) / 2;

		// 使用 callback 页面，传递 bind_mode=true 和 token
		const bindWindow = window.open(
			`/auth/callback?bind_mode=true&token=${token}`,
			"bind_anonymous",
			`width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
		);

		if (!bindWindow) {
			toast.error("无法打开绑定窗口，请检查浏览器弹窗设置");
			return;
		}

		// 监听绑定结果
		const handleMessage = (event: MessageEvent) => {
			if (event.origin !== window.location.origin)
				return;

			if (event.data.type === "bind_success") {
				toast.success("绑定成功！");
				// 更新 token 并重新获取用户信息
				if (event.data.token) {
					// 使用新 token 重新获取用户信息
					const newToken = event.data.token;
					fetch(`${API_BASE_URL}/auth/me`, {
						headers: {
							Authorization: `Bearer ${newToken}`,
						},
					})
						.then(res => res.json())
						.then((data) => {
							if (data.code === 200) {
								useAuthStore.getState().setAuth(data.data, newToken);
							}
						})
						.catch(console.error);
				}
				window.removeEventListener("message", handleMessage);
			} else if (event.data.type === "bind_error") {
				toast.error(event.data.message || "绑定失败");
				window.removeEventListener("message", handleMessage);
			}
		};

		window.addEventListener("message", handleMessage);
	};

	// 加载关联账号
	const loadAccounts = useCallback(async () => {
		if (!token)
			return;

		setIsLoadingAccounts(true);
		try {
			const response = await getUserAccounts(token);
			if (response.code === 200) {
				setAccounts(response.data);
			}
		} catch (error) {
			console.error("Failed to load accounts:", error);
		} finally {
			setIsLoadingAccounts(false);
		}
	}, [token]);

	useEffect(() => {
		if (isOpen && token) {
			loadAccounts();
		}
	}, [isOpen, token, loadAccounts]);

	const handleLogout = () => {
		clearAuth();
		onClose();
		toast.success("已退出登录");
	};

	if (!authUser)
		return null;

	return isOpen
		? (
				<motion.div
					initial={{ opacity: 0, y: 10, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 10, scale: 0.95 }}
					className="absolute bottom-full right-0 mb-3 z-50 w-[320px] max-h-[600px] overflow-y-auto bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-glass"
				>
					{/* 用户信息头部 */}
					<div className="p-5 flex flex-col items-center gap-3 bg-muted/30 sticky top-0 z-10">
						<div className="relative">
							<img
								src={authUser.image}
								alt={authUser.name}
								className="size-20 rounded-full border-4 border-background shadow-sm"
							/>
							<div className="absolute bottom-0 right-0 bg-green-500 w-4 h-4 rounded-full border-2 border-background" />
						</div>
						<div className="text-center">
							<h3 className="font-bold text-foreground text-lg">{authUser.name}</h3>
							<p className="text-xs text-muted-foreground mt-1">{authUser.email}</p>
						</div>
					</div>

					<div className="p-4 space-y-4">
						{/* 关联账号 */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
									<Icon icon="mingcute:link-line" className="size-4" />
									关联账号
								</h4>
							</div>
							{isLoadingAccounts
								? (
										<div className="flex items-center justify-center py-4">
											<Icon icon="svg-spinners:ring-resize" className="size-5 text-accent-500" />
										</div>
									)
								: accounts.length > 0
									? (
											<div className="space-y-2">
												{accounts.map(account => (
													<div
														key={account._id}
														className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
													>
														{account.oauth_avatar
															? (
																	<img
																		src={account.oauth_avatar}
																		alt={account.oauth_name || account.provider}
																		className="size-8 rounded-full border border-border object-cover"
																	/>
																)
															: (
																	<div className="size-8 rounded-full bg-muted flex items-center justify-center">
																		<Icon
																			icon={
																				account.provider === "github"
																					? "mingcute:github-line"
																					: "mingcute:qq-line"
																			}
																			className="size-5 text-muted-foreground"
																		/>
																	</div>
																)}
														<div className="flex-1 min-w-0">
															<p className="text-sm font-medium text-foreground capitalize">
																{account.provider}
															</p>
															<p className="text-xs text-muted-foreground truncate">
																{account.oauth_name || account.accountId}
															</p>
														</div>
													</div>
												))}
											</div>
										)
									: (
											<p className="text-xs text-muted-foreground text-center py-2">
												暂无关联账号
											</p>
										)}

							{/* 关联新账号按钮 */}
							<div className="mt-3 space-y-2">
								<div className="text-xs text-muted-foreground mb-2">关联更多账号：</div>
								<div className="grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => {
											window.open(`${API_BASE_URL}/auth/oauth/github`, "_blank");
										}}
										disabled={accounts.some(acc => acc.provider === "github")}
										className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<Icon icon="mingcute:github-line" className="size-4" />
										<span className="text-xs font-medium">GitHub</span>
									</button>
									<button
										type="button"
										onClick={() => {
											window.open(`${API_BASE_URL}/auth/oauth/qq`, "_blank");
										}}
										disabled={accounts.some(acc => acc.provider === "qq")}
										className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<Icon icon="mingcute:qq-line" className="size-4" />
										<span className="text-xs font-medium">QQ</span>
									</button>
								</div>
							</div>
						</div>

						{/* 头像选择器 */}
						{accounts.length > 0 && (
							<div>
								<h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-3">
									<Icon icon="mingcute:user-4-line" className="size-4" />
									更换头像
								</h4>
								<AvatarSelector
									accounts={accounts}
									currentAvatar={authUser.image}
									userEmail={authUser.email}
									onAvatarChange={() => {
										fetchUser();
										onAvatarChange?.();
									}}
								/>
							</div>
						)}

						{/* 绑定匿名身份 */}
						<div>
							<h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-3">
								<Icon icon="mingcute:link-2-line" className="size-4" />
								绑定匿名身份
							</h4>
							<button
								type="button"
								onClick={() => {
									openBindWindow();
									onClose();
								}}
								className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer text-sm"
							>
								<Icon icon="mingcute:user-add-line" className="size-4" />
								<span>关联历史评论</span>
							</button>
							<p className="text-xs text-muted-foreground mt-2">
								将之前的匿名评论关联到当前账号
							</p>
						</div>

						{/* 操作按钮 */}
						<div className="pt-2 border-t border-border/50">
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={onClose}
									className="flex items-center justify-center py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
								>
									关闭
								</button>
								<button
									type="button"
									onClick={handleLogout}
									className="flex items-center justify-center py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
								>
									退出登录
								</button>
							</div>
						</div>
					</div>
				</motion.div>
			)
		: null;
}
