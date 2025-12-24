"use client";

import { Icon } from "@iconify/react/offline";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
	onClick: () => void;
	disabled: boolean;
	isPending: boolean;
}

/**
 * 评论提交按钮
 */
export function SubmitButton({ onClick, disabled, isPending }: SubmitButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm h-7 sm:h-8 cursor-pointer",
				!disabled
					? "bg-accent-600 text-white hover:bg-accent-500 hover:shadow-accent-500/20 active:scale-95"
					: "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
			)}
		>
			{isPending
				? <Icon icon="mingcute:loading-line" className="animate-spin size-3.5 sm:size-4" />
				: <Icon icon="mingcute:send-plane-fill" className="size-3.5 sm:size-4" />}
			<span className="hidden sm:inline">发送</span>
		</button>
	);
}
