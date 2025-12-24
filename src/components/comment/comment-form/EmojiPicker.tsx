"use client";

import type { OwOItem, OwOResponse } from "./types";
import { Icon } from "@iconify/react/offline";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseOwOIcon } from "./utils";

interface EmojiPickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	owoData: OwOResponse | null;
	activePkg: string;
	onPackageChange: (pkg: string) => void;
	onEmojiSelect: (item: OwOItem) => void;
}

/**
 * 单个表情项组件，带 hover 预览
 */
function EmojiItem({ item, onSelect }: { item: OwOItem; onSelect: (item: OwOItem) => void }) {
	const [previewOpen, setPreviewOpen] = useState(false);
	const iconUrl = parseOwOIcon(item.icon);

	return (
		<Popover open={previewOpen} onOpenChange={setPreviewOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					onClick={() => onSelect(item)}
					onMouseEnter={() => setPreviewOpen(true)}
					onMouseLeave={() => setPreviewOpen(false)}
					className="relative w-full aspect-square flex items-center justify-center p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer group"
				>
					<img
						src={iconUrl}
						alt={item.text}
						className="w-full h-full object-contain"
						loading="lazy"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="center"
				className="w-auto p-2 pointer-events-none"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex flex-col items-center gap-1.5">
					<img
						src={iconUrl}
						alt={item.text}
						className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
					/>
					<span className="text-xs text-muted-foreground">{item.text}</span>
				</div>
			</PopoverContent>
		</Popover>
	);
}

/**
 * 表情选择器 Popover
 */
export function EmojiPicker({
	open,
	onOpenChange,
	owoData,
	activePkg,
	onPackageChange,
	onEmojiSelect,
}: EmojiPickerProps) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"text-muted-foreground transition-colors flex items-center cursor-pointer hover:text-accent-600",
						open && "text-accent-600",
					)}
				>
					<Icon icon="mingcute:emoji-line" width="18" height="18" className="sm:w-5 sm:h-5" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="start"
				className="w-[calc(100vw-2rem)] sm:w-[300px] max-w-[300px] p-2"
			>
				{owoData && (
					<>
						{/* 分类标签 */}
						<div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/50 scrollbar-none mb-2">
							{Object.keys(owoData).map(pkg => (
								<button
									key={pkg}
									type="button"
									onClick={() => onPackageChange(pkg)}
									className={cn(
										"text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors cursor-pointer",
										activePkg === pkg
											? "bg-accent-100 text-accent-700 font-medium"
											: "text-muted-foreground hover:bg-muted",
									)}
								>
									{pkg}
								</button>
							))}
						</div>

						{/* 表情网格 */}
						<div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 sm:gap-2 max-h-32 sm:max-h-40 overflow-y-auto">
							{owoData[activePkg]?.container.map(item => (
								<EmojiItem
									key={`${activePkg}-${item.text}`}
									item={item}
									onSelect={onEmojiSelect}
								/>
							))}
						</div>
					</>
				)}
			</PopoverContent>
		</Popover>
	);
}
