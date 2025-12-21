"use client";

import { useState } from "react";
import { toast } from "sonner";
import { bindAnonymousIdentity } from "@/lib/api-client";

interface BindAnonymousDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	token: string;
}

/**
 * 绑定匿名身份对话框
 *
 * 用于首次 OAuth 登录后，询问用户是否要绑定之前的匿名评论
 */
export function BindAnonymousDialog({ isOpen, onClose, onSuccess, token }: BindAnonymousDialogProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [isBinding, setIsBinding] = useState(false);

	if (!isOpen)
		return null;

	const handleBind = async () => {
		if (!name.trim() || !email.trim()) {
			toast.error("请输入昵称和邮箱");
			return;
		}

		// 简单的邮箱格式验证
		const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			toast.error("请输入有效的邮箱地址");
			return;
		}

		setIsBinding(true);

		try {
			const response = await bindAnonymousIdentity({ name, email }, token);

			if (response.code === 200) {
				toast.success(response.message);
				onSuccess();
				onClose();
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

	const handleSkip = () => {
		// 直接关闭弹窗，不记住用户选择
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
				{/* 四个角装饰 */}
				<span className="absolute top-0 left-0 h-3 w-3 rounded-tl-sm border-l-2 border-t-2 border-accent" />
				<span className="absolute top-0 right-0 h-3 w-3 rounded-tr-sm border-r-2 border-t-2 border-accent" />
				<span className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-sm border-b-2 border-l-2 border-accent" />
				<span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-sm border-b-2 border-r-2 border-accent" />

				<h2 className="mb-4 text-xl font-bold text-gray-800">
					绑定匿名身份
				</h2>

				<p className="mb-4 text-sm text-gray-600">
					如果您之前以匿名身份发表过评论，可以在此绑定，将历史评论关联到您的账号。
				</p>

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

				<p className="mb-4 text-xs text-gray-500">
					💡 提示：昵称和邮箱必须与之前的匿名评论完全一致才能绑定成功
				</p>

				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleSkip}
						disabled={isBinding}
						className="flex-1 cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						跳过
					</button>
					<button
						type="button"
						onClick={handleBind}
						disabled={isBinding}
						className="flex-1 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
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
		</div>
	);
}
