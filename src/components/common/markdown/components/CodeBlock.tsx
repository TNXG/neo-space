"use client";

import { Icon } from "@iconify/react";
import React, { useState } from "react";
import { toast } from "sonner";
import { FileIcon } from "@/lib/file-icons";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	children: React.ReactNode;
	className?: string;
	language?: string;
	filename?: string; // 新增：支持显示文件名
	style?: React.CSSProperties;
}

export function CodeBlock({ children, className, language = "text", filename, style }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const codeText = extractTextContent(children);

		try {
			await navigator.clipboard.writeText(codeText);
			setCopied(true);
			toast.success("代码已复制到剪贴板"); // Sonner 提示

			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
			toast.error("复制失败");
		}
	};

	return (
		<div className="group relative my-6 overflow-hidden rounded-xl border border-zinc-200 bg-white/50 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/50 backdrop-blur-sm">

			{/* Header 区域 */}
			<div className="flex h-11 items-center justify-between border-b border-zinc-200/60 bg-zinc-50/50 px-4 dark:border-zinc-800/60 dark:bg-zinc-900/50">

				{/* 左侧：macOS 风格控制点 + 文件信息 */}
				<div className="flex items-center gap-4">
					{/* 装饰性控制点 (Hover 时稍微变亮) */}
					<div className="flex items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
						<div className="h-3 w-3 rounded-full bg-[#ff5f57] ring-1 ring-inset ring-black/10" />
						<div className="h-3 w-3 rounded-full bg-[#febc2e] ring-1 ring-inset ring-black/10" />
						<div className="h-3 w-3 rounded-full bg-[#28c840] ring-1 ring-inset ring-black/10" />
					</div>

					{/* 文件图标和名称 */}
					<div className="flex items-center gap-2 select-none">
						<FileIcon
							extension={language}
							className="h-4 w-4 shrink-0"
						/>
						<span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
							{filename || language}
						</span>
					</div>
				</div>

				{/* 右侧：复制按钮 */}
				<button
					type="button"
					onClick={handleCopy}
					className={cn(
						"relative flex h-7 items-center justify-center rounded-md px-2 transition-all duration-200",
						"text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900",
						"dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
					)}
					aria-label="Copy code"
				>
					<div className="relative h-4 w-4">
						<Icon
							icon="mingcute:copy-2-line"
							className={cn(
								"absolute inset-0 h-4 w-4 transition-all duration-300",
								copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
							)}
						/>
						<Icon
							icon="mingcute:check-line"
							className={cn(
								"absolute inset-0 h-4 w-4 text-emerald-500 transition-all duration-300",
								copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
							)}
						/>
					</div>
					{/* 可选：如果你想在按钮旁显示文字，可以取消注释 */}
					{/* <span className="ml-1.5 text-xs">{copied ? "Copied" : "Copy"}</span> */}
				</button>
			</div>

			{/* 代码内容区域 */}
			<div className="relative overflow-x-auto">
				<pre
					className={cn(
						"min-w-full p-4 text-[13px] leading-relaxed font-mono custom-scrollbar",
						"bg-transparent", // 强制透明，让父级背景生效，或者保留 Shiki 的背景
						className,
					)}
					style={{
						...style,
						margin: 0, // 强制重置 margin
						// 如果你想覆盖 Shiki 的背景色以适配你的 UI，可以取消下面的注释
						// backgroundColor: "transparent",
					}}
				>
					{children}
				</pre>
			</div>
		</div>
	);
}

/**
 * 递归提取 React 节点中的文本内容
 */
function extractTextContent(node: React.ReactNode): string {
	if (!node)
		return "";
	if (typeof node === "string")
		return node;
	if (typeof node === "number")
		return String(node);

	if (Array.isArray(node)) {
		return node.map(extractTextContent).join("");
	}

	if (React.isValidElement(node)) {
		const props = node.props as { children?: React.ReactNode };
		return extractTextContent(props.children);
	}

	return "";
}
