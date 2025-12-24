"use client";

import type { AccountInfo } from "@/lib/api-client";
import { Icon } from "@iconify/react/offline";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { API_BASE_URL, getUserAccounts } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { AvatarSelector } from "./AvatarSelector";

interface ProfilePopoverProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onAvatarChange?: () => void;
	children: React.ReactNode;
}

/**
 * 个人资料弹窗组件
 *
 * 显示用户信息、关联账号和头像选择器
 */
export function ProfilePopover({ isOpen, onOpenChange, onAvatarChange, children }: ProfilePopoverProps) {
	const { user: authUser, token, clearAuth, fetchUser } = useAuthStore();
	const [accounts, setAccounts] = useState<AccountInfo[]>([]);
	const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

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
		onOpenChange(false);
		toast.success("已退出登录");
	};

	if (!authUser)
		return null;

	return (
		<Popover open={isOpen} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				{children}
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="end"
				className="w-[280px] sm:w-[320px] p-0 overflow-hidden"
				onPointerDownOutside={(e) => {
					const target = e.target as HTMLElement;
					if (
						target.closest("[role=\"listbox\"]")
						|| target.closest("[role=\"menu\"]")
						|| target.closest("[role=\"dialog\"]")
						|| target.closest(".radix-select-content")
						|| target.closest(".cmdk-list")
					) {
						e.preventDefault();
					}
				}}
			>
				{/* 用户信息头部 */}
				<div className="p-3 sm:p-4 flex flex-col items-center gap-2 sm:gap-3 bg-muted/30">
					<div className="relative">
						<img
							src={authUser.image}
							alt={authUser.name}
							className="size-12 sm:size-16 rounded-full border-4 border-background shadow-sm"
						/>
						<div className="absolute bottom-0 right-0 bg-green-500 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-background" />
					</div>
					<div className="text-center">
						<h3 className="font-bold text-foreground text-sm sm:text-base">{authUser.name}</h3>
						<p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate max-w-[200px] sm:max-w-none">{authUser.email}</p>
					</div>
				</div>

				<div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
					{/* 关联账号 */}
					<div>
						<div className="flex items-center justify-between mb-1.5 sm:mb-2">
							<h4 className="text-[11px] sm:text-xs font-semibold text-muted-foreground flex items-center gap-1.5 sm:gap-2">
								<Icon icon="mingcute:link-line" className="size-3.5 sm:size-4" />
								关联账号
							</h4>
						</div>
						{isLoadingAccounts
							? (
									<div className="flex items-center justify-center py-2 sm:py-3">
										<Icon icon="mingcute:loading-line" className="size-3.5 sm:size-4 text-accent-500 animate-spin" />
									</div>
								)
							: accounts.length > 0
								? (
										<div className="space-y-1 sm:space-y-1.5">
											{accounts.slice(0, 2).map(account => (
												<div
													key={account._id}
													className="flex items-center gap-2 sm:gap-2.5 p-1.5 sm:p-2 rounded-lg bg-muted/50"
												>
													{account.oauth_avatar
														? (
																<img
																	src={account.oauth_avatar}
																	alt={account.oauth_name || account.provider}
																	className="size-6 sm:size-7 rounded-full border border-border object-cover"
																/>
															)
														: (
																<div className="size-6 sm:size-7 rounded-full bg-muted flex items-center justify-center">
																	<Icon
																		icon={
																			account.provider === "github"
																				? "mingcute:github-line"
																				: "mingcute:qq-line"
																		}
																		className="size-3.5 sm:size-4 text-muted-foreground"
																	/>
																</div>
															)}
													<div className="flex-1 min-w-0">
														<p className="text-xs sm:text-sm font-medium text-foreground">
															{account.provider === "github" ? "GitHub" : account.provider === "qq" ? "QQ" : account.provider}
														</p>
														<p className="text-[10px] sm:text-xs text-muted-foreground truncate">
															{account.oauth_name || account.accountId}
														</p>
													</div>
												</div>
											))}
											{accounts.length > 2 && (
												<p className="text-[10px] sm:text-xs text-muted-foreground text-center py-0.5 sm:py-1">
													还有
													{" "}
													{accounts.length - 2}
													{" "}
													个账号...
												</p>
											)}
										</div>
									)
								: (
										<p className="text-[10px] sm:text-xs text-muted-foreground text-center py-1.5 sm:py-2">
											暂无关联账号
										</p>
									)}

						{/* 关联新账号按钮 */}
						<div className="mt-1.5 sm:mt-2 space-y-1.5 sm:space-y-2">
							<div className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-1.5">关联更多账号：</div>
							<div className="grid grid-cols-2 gap-1.5 sm:gap-2">
								<button
									type="button"
									onClick={() => {
										window.open(`${API_BASE_URL}/auth/oauth/github`, "_blank");
									}}
									disabled={accounts.some(acc => acc.provider === "github")}
									className="flex items-center justify-center gap-1 sm:gap-1.5 py-1 sm:py-1.5 px-2 sm:px-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<Icon icon="mingcute:github-line" className="size-3 sm:size-3.5" />
									<span className="text-[10px] sm:text-xs font-medium">GitHub</span>
								</button>
								<button
									type="button"
									onClick={() => {
										window.open(`${API_BASE_URL}/auth/oauth/qq`, "_blank");
									}}
									disabled={accounts.some(acc => acc.provider === "qq")}
									className="flex items-center justify-center gap-1 sm:gap-1.5 py-1 sm:py-1.5 px-2 sm:px-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<Icon icon="mingcute:qq-line" className="size-3 sm:size-3.5" />
									<span className="text-[10px] sm:text-xs font-medium">QQ</span>
								</button>
							</div>
						</div>
					</div>

					{/* 头像选择器 */}
					{accounts.length > 1 && (
						<div>
							<h4 className="text-[10px] sm:text-xs font-semibold text-muted-foreground flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
								<Icon icon="mingcute:user-4-line" className="size-3.5 sm:size-4" />
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

					{/* 操作按钮 */}
					<div className="pt-1.5 sm:pt-2 border-t border-border/50">
						<div className="grid grid-cols-2 gap-1.5 sm:gap-2">
							<button
								type="button"
								onClick={() => onOpenChange(false)}
								className="flex items-center justify-center py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
							>
								关闭
							</button>
							<button
								type="button"
								onClick={handleLogout}
								className="flex items-center justify-center py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
							>
								退出登录
							</button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
