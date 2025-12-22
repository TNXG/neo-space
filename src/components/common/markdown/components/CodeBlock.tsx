"use client";

import { Icon } from "@iconify/react/offline";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { useHasMounted } from "@/hook/use-has-mounted";
import { FileIcon } from "@/lib/file-icons";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	children: React.ReactNode;
	className?: string;
	language?: string;
	filename?: string;
	style?: React.CSSProperties;
	fallbackText?: string;
}

export function CodeBlock({ children, className, language = "text", filename, style, fallbackText }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);
	const mounted = useHasMounted();
	const preRef = useRef<HTMLPreElement>(null);

	const handleCopy = async () => {
		const codeText = (preRef.current?.textContent ?? fallbackText ?? extractTextContent(children)).trimEnd();

		if (!codeText) {
			toast.error("没有可复制的内容");
			return;
		}

		try {
			await navigator.clipboard.writeText(codeText);
			setCopied(true);
			toast.success("代码已复制到剪贴板");
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
			toast.error("复制失败");
		}
	};

	return (
		<div className="group relative my-5 md:my-6 overflow-hidden rounded-xl border border-zinc-200 bg-white/50 shadow-sm transition-all hover:shadow-md backdrop-blur-sm">
			<div className="flex h-10 md:h-11 items-center justify-between border-b border-zinc-200/60 bg-zinc-50/50 px-3 md:px-4">
				<div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 overflow-hidden">
					<div className="hidden sm:flex items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100 shrink-0">
						<div className="h-3 w-3 rounded-full bg-[#ff5f57] ring-1 ring-inset ring-black/10" />
						<div className="h-3 w-3 rounded-full bg-[#febc2e] ring-1 ring-inset ring-black/10" />
						<div className="h-3 w-3 rounded-full bg-[#28c840] ring-1 ring-inset ring-black/10" />
					</div>
					<div className="flex items-center gap-1.5 md:gap-2 select-none min-w-0 overflow-hidden">
						<FileIcon extension={language} className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
						<span className="text-[11px] md:text-xs font-medium text-zinc-600 truncate">
							{filename || language}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={handleCopy}
					className={cn(
						"relative flex h-6 md:h-7 items-center justify-center rounded-md px-1.5 md:px-2 transition-all duration-200 cursor-pointer shrink-0",
						"text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900",
						"",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
					)}
					aria-label="Copy code"
				>
					<div className="relative h-3.5 w-3.5 md:h-4 md:w-4">
						<Icon
							icon="mingcute:copy-2-line"
							className={cn(
								"absolute inset-0 h-3.5 w-3.5 md:h-4 md:w-4 transition-all duration-300",
								copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
							)}
						/>
						<Icon
							icon="mingcute:check-line"
							className={cn(
								"absolute inset-0 h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-500 transition-all duration-300",
								copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
							)}
						/>
					</div>
				</button>
			</div>

			<div className="relative overflow-x-auto">
				{!mounted
					? (
							<pre
								className={cn(
									"min-w-full p-3 md:p-4 text-xs md:text-[13px] leading-relaxed font-mono custom-scrollbar bg-transparent",
									className,
								)}
								style={{ ...style, margin: 0 }}
							>
								<code>{fallbackText || extractTextContent(children)}</code>
							</pre>
						)
					: (
							<pre
								ref={preRef}
								className={cn(
									"min-w-full p-3 md:p-4 text-xs md:text-[13px] leading-relaxed font-mono custom-scrollbar bg-transparent",
									className,
								)}
								style={{ ...style, margin: 0 }}
								suppressHydrationWarning
							>
								{children}
							</pre>
						)}
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
