"use client";

import type { OwOItem, OwOResponse, TurnstileStatus as TurnstileStatusType } from "./types";
import { KbdShortcut } from "@/components/ui/kbd";
import { VerticalSlider } from "@/components/ui/toggle-switch";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";
import { TurnstileStatus } from "./TurnstileStatus";

interface ToolbarLeftProps {
	// Emoji
	showEmoji: boolean;
	onEmojiOpenChange: (open: boolean) => void;
	owoData: OwOResponse | null;
	activePkg: string;
	onPackageChange: (pkg: string) => void;
	onEmojiSelect: (item: OwOItem) => void;
	// Preview
	preview: boolean;
	onPreviewChange: (preview: boolean) => void;
	// Content
	contentLength: number;
	// Turnstile (仅非登录用户)
	showTurnstile: boolean;
	turnstileStatus: TurnstileStatusType;
}

/**
 * 工具栏左侧功能区：表情 + 预览 + 快捷键 + 字数统计 + 验证状态
 */
export function ToolbarLeft({
	showEmoji,
	onEmojiOpenChange,
	owoData,
	activePkg,
	onPackageChange,
	onEmojiSelect,
	preview,
	onPreviewChange,
	contentLength,
	showTurnstile,
	turnstileStatus,
}: ToolbarLeftProps) {
	return (
		<div className="flex items-center gap-3 sm:gap-4">
			{/* 表情选择器 */}
			<EmojiPicker
				open={showEmoji}
				onOpenChange={onEmojiOpenChange}
				owoData={owoData}
				activePkg={activePkg}
				onPackageChange={onPackageChange}
				onEmojiSelect={onEmojiSelect}
			/>

			{/* 预览开关 */}
			<div className="flex items-center gap-1.5 sm:gap-2">
				<VerticalSlider
					checked={preview}
					onChange={onPreviewChange}
					size="sm"
					className="cursor-pointer"
				/>
				<span className="text-[11px] sm:text-xs text-muted-foreground select-none">预览</span>
			</div>

			{/* 快捷键提示 */}
			<div className="hidden md:flex items-center gap-1.5">
				<KbdShortcut keys={["Ctrl", "Enter"]} />
				<span className="text-[11px] text-muted-foreground select-none">快速发送</span>
			</div>

			{/* 字数统计 */}
			{contentLength > 0 && (
				<span className={cn(
					"text-[10px] sm:text-xs font-mono tabular-nums",
					contentLength > 1000 ? "text-red-500 font-semibold" : "text-muted-foreground",
				)}
				>
					{contentLength}
					/1000
				</span>
			)}

			{/* 验证状态显示（仅非登录用户） */}
			{showTurnstile && (
				<TurnstileStatus status={turnstileStatus} />
			)}
		</div>
	);
}
