"use client";

import type { AccountInfo } from "@/lib/api-client";
import { Icon } from "@iconify/react/offline";
import { useState } from "react";
import { toast } from "sonner";
import { updateAvatar } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";

interface AvatarSelectorProps {
	accounts: AccountInfo[];
	currentAvatar: string;
	userEmail: string;
	onAvatarChange?: () => void;
}

type AvatarProvider = "github" | "qq" | "gravatar";

/**
 * 头像选择器组件 - 简单的下拉选择
 *
 * 前端只传递 provider，后端负责获取对应的头像 URL
 */
export function AvatarSelector({ accounts, currentAvatar, userEmail, onAvatarChange }: AvatarSelectorProps) {
	const { token, fetchUser } = useAuthStore();
	const [isUpdating, setIsUpdating] = useState(false);

	// 检测当前头像来源
	const detectCurrentProvider = (): AvatarProvider => {
		if (currentAvatar.includes("gravatar.com"))
			return "gravatar";

		// 简单判断：如果有 GitHub 账号且不是 gravatar，假设是 GitHub
		const hasGithub = accounts.some(acc => acc.provider === "github");
		const hasQQ = accounts.some(acc => acc.provider === "qq");

		if (hasGithub && !currentAvatar.includes("qq"))
			return "github";
		if (hasQQ)
			return "qq";

		return "gravatar";
	};

	const [selectedProvider, setSelectedProvider] = useState<AvatarProvider>(() => detectCurrentProvider());

	// 构建选项列表（排除 QQ 的临时邮箱）
	const options: Array<{ value: AvatarProvider; label: string; icon: string }> = [
		{
			value: "gravatar",
			label: "Gravatar（邮箱头像）",
			icon: "mingcute:mail-line",
		},
	];

	// 添加已关联的账号
	if (accounts.some(acc => acc.provider === "github")) {
		options.push({
			value: "github",
			label: "GitHub",
			icon: "mingcute:github-line",
		});
	}

	// 只有当邮箱不是 QQ 临时邮箱时才添加 QQ 选项
	const qqAccount = accounts.find(acc => acc.provider === "qq");
	if (qqAccount && !userEmail.endsWith("@qq.oauth")) {
		options.push({
			value: "qq",
			label: "QQ",
			icon: "mingcute:qq-line",
		});
	}

	const handleChange = async (provider: AvatarProvider) => {
		if (!token) {
			toast.error("未登录");
			return;
		}

		if (provider === selectedProvider) {
			return;
		}

		setIsUpdating(true);
		setSelectedProvider(provider);

		try {
			const response = await updateAvatar({ provider }, token);

			if (response.code === 200) {
				toast.success("头像更新成功");
				await fetchUser();
				onAvatarChange?.();
			} else {
				toast.error(response.message || "更新失败");
				setSelectedProvider(detectCurrentProvider());
			}
		} catch (error) {
			console.error("Update avatar error:", error);
			toast.error("更新失败，请稍后重试");
			setSelectedProvider(detectCurrentProvider());
		} finally {
			setIsUpdating(false);
		}
	};

	if (options.length <= 1) {
		return null; // 只有一个选项时不显示选择器
	}

	return (
		<div className="space-y-1.5">
			<div className="relative">
				<select
					value={selectedProvider}
					onChange={e => handleChange(e.target.value as AvatarProvider)}
					disabled={isUpdating}
					className="w-full appearance-none rounded-lg border border-border bg-background px-2.5 py-1.5 pr-8 text-xs text-foreground outline-none transition-colors hover:border-accent-300 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{options.map(option => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>

				{/* 下拉箭头图标 */}
				<div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
					{isUpdating
						? (
								<Icon icon="mingcute:loading-line" className="size-3.5 text-muted-foreground animate-spin" />
							)
						: (
								<Icon icon="mingcute:down-line" className="size-3.5 text-muted-foreground" />
							)}
				</div>
			</div>

			<p className="text-xs text-muted-foreground/80">
				选择头像来源
			</p>
		</div>
	);
}
