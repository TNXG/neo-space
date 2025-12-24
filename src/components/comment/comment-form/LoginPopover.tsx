"use client";

import { Icon } from "@iconify/react/offline";

import { useState } from "react";
import { OAuthButtons } from "@/components/comment/auth/OAuthButtons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * 登录 Popover 组件
 * 使用 shadcn/ui Popover，内部管理状态
 */
export function LoginPopover() {
	const [open, setOpen] = useState(false);
	const [isRedirecting, setIsRedirecting] = useState(false);

	const handleOAuthClick = () => {
		setIsRedirecting(true);
		setTimeout(() => setOpen(false), 1500);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"p-1 sm:p-1.5 rounded-full transition-all cursor-pointer",
						open
							? "text-accent-600 bg-accent-50"
							: "text-muted-foreground hover:text-accent-600 hover:bg-primary-50/50",
					)}
					title="登录"
				>
					<Icon icon="mingcute:user-3-line" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="end"
				className="w-[220px] sm:w-[260px] p-4 sm:p-6"
			>
				<div className="text-center mb-4 sm:mb-5">
					<h3 className="font-serif text-lg sm:text-xl font-medium text-foreground">登录</h3>
				</div>

				{isRedirecting
					? (
							<div className="flex flex-col items-center justify-center py-4 sm:py-6 gap-2 sm:gap-3">
								<Icon icon="mingcute:loading-line" className="size-6 sm:size-8 text-accent-500 animate-spin" />
								<span className="text-[11px] sm:text-xs text-muted-foreground animate-pulse">正在前往登录...</span>
							</div>
						)
					: (
							<div>
								<ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-5 text-[11px] sm:text-xs text-muted-foreground">
									<li className="flex items-center gap-2 sm:gap-3">
										<Icon icon="mingcute:check-circle-line" className="text-accent-500 shrink-0 size-3.5 sm:size-4" />
										<span>无需进行人机验证</span>
									</li>
									<li className="flex items-center gap-2 sm:gap-3">
										<Icon icon="mingcute:check-circle-line" className="text-accent-500 shrink-0 size-3.5 sm:size-4" />
										<span>编辑和删除自己的想法</span>
									</li>
									<li className="flex items-center gap-2 sm:gap-3">
										<Icon icon="mingcute:heart-fill" className="text-accent-500 shrink-0 size-3.5 sm:size-4" />
										<span>我喜欢你</span>
									</li>
								</ul>

								<div className="border-t border-dashed border-border/50 my-3 sm:my-4" />

								<div className="flex flex-col gap-2 sm:gap-2.5">
									<div onClick={handleOAuthClick}>
										<OAuthButtons variant="compact" className="flex-col" />
									</div>
								</div>

								<button
									type="button"
									onClick={() => setOpen(false)}
									className="w-full mt-3 sm:mt-4 py-1 text-[11px] sm:text-xs text-muted-foreground/60 hover:text-foreground transition-colors bg-muted/30 rounded cursor-pointer"
								>
									取消
								</button>
							</div>
						)}
			</PopoverContent>
		</Popover>
	);
}
