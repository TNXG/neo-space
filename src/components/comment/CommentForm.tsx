"use client";

import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createCommentAction } from "@/actions/comment";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { VerticalSlider } from "@/components/ui/toggle-switch";
import { useHasMounted } from "@/hook/use-has-mounted";
import { cn } from "@/lib/utils";

interface OwOItem { text: string; icon: string }
interface OwOPackage { type: string; container: OwOItem[] }
type OwOResponse = Record<string, OwOPackage>;

const parseOwOIcon = (iconString: string): string => {
	const match = iconString.match(/src="([^"]+)"/);
	return match && match[1] ? (match[1].startsWith("http") ? match[1] : `https://${match[1]}`) : "";
};

interface CommentFormProps {
	refId: string;
	refType: "posts" | "pages" | "notes";
	parentId?: string;
	onSuccess?: () => void;
	onCancel?: () => void;
	autoFocus?: boolean;
}

const STORAGE_KEY_USER = "comment-user-data";
const STORAGE_KEY_DRAFT_PREFIX = "comment-draft-";
const STORAGE_KEY_PREVIEW = "comment-preview-mode";

export function CommentForm({ refId, refType, parentId, onSuccess, onCancel, autoFocus = false }: CommentFormProps) {
	const hasMounted = useHasMounted();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isPending, startTransition] = useTransition();

	const draftKey = `${STORAGE_KEY_DRAFT_PREFIX}${refId}-${parentId || "root"}`;

	// 使用 lazy initialization，但只在客户端读取 localStorage
	const [user, setUser] = useState(() => {
		// SSR 时返回默认值
		if (!hasMounted)
			return { name: "", email: "", url: "" };

		const savedUser = localStorage.getItem(STORAGE_KEY_USER);
		if (savedUser) {
			try {
				return JSON.parse(savedUser);
			} catch (error) {
				console.error("Failed to parse saved user data:", error);
			}
		}
		return { name: "", email: "", url: "" };
	});

	const [content, setContent] = useState(() => {
		// SSR 时返回默认值
		if (!hasMounted)
			return "";

		const draft = localStorage.getItem(draftKey);
		return draft || "";
	});

	const [preview, setPreview] = useState(() => {
		// SSR 时返回默认值
		if (!hasMounted)
			return false;

		const savedPreview = localStorage.getItem(STORAGE_KEY_PREVIEW);
		return savedPreview === "true";
	});

	const [showEmoji, setShowEmoji] = useState(false);
	const [owoData, setOwoData] = useState<OwOResponse | null>(null);
	const [activePkg, setActivePkg] = useState<string>("");
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
	const emojiContainerRef = useRef<HTMLDivElement>(null);

	// 处理预览状态记忆
	useEffect(() => {
		if (!hasMounted)
			return;
		localStorage.setItem(STORAGE_KEY_PREVIEW, preview.toString());
	}, [preview, hasMounted]);

	// 处理自动聚焦
	useEffect(() => {
		if (hasMounted && autoFocus && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [hasMounted, autoFocus]);

	// 防抖保存草稿
	useEffect(() => {
		if (!hasMounted)
			return;

		// 清除之前的定时器
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		// 设置新的定时器
		debounceTimerRef.current = setTimeout(() => {
			if (content) {
				localStorage.setItem(draftKey, content);
			} else {
				localStorage.removeItem(draftKey);
			}
		}, 500); // 500ms 防抖

		// 清理函数
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [content, hasMounted, draftKey]);
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [content]);

	// 防抖切换 Emoji 面板
	const toggleEmoji = useCallback(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}
		debounceTimerRef.current = setTimeout(() => {
			setShowEmoji(prev => !prev);
		}, 150);
	}, []);

	// 点击外部关闭 Emoji 面板
	useEffect(() => {
		if (!showEmoji)
			return;

		const handleClickOutside = (event: MouseEvent) => {
			if (emojiContainerRef.current && !emojiContainerRef.current.contains(event.target as Node)) {
				setShowEmoji(false);
			}
		};

		// 延迟添加监听器，避免立即触发
		const timer = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside);
		}, 100);

		return () => {
			clearTimeout(timer);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showEmoji]);

	useEffect(() => {
		if (showEmoji && !owoData) {
			fetch("https://cdn.tnxg.top/images/face/owo.json")
				.then(res => res.json())
				.then((d) => {
					setOwoData(d);
					setActivePkg(Object.keys(d)[0]);
				});
		}
	}, [showEmoji, owoData]);

	const insertEmoji = (item: OwOItem) => {
		const url = parseOwOIcon(item.icon);
		const input = textareaRef.current;
		if (!input)
			return;
		const start = input.selectionStart;
		setContent(`${content.substring(0, start)}![${item.text}](${url})${content.substring(input.selectionEnd)}`);
		setShowEmoji(false);
		setTimeout(() => input.focus(), 0);
	};

	const handleSubmit = () => {
		if (!content.trim() || !user.name)
			return;

		localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));

		startTransition(async () => {
			try {
				await createCommentAction({
					ref: refId,
					refType,
					parent: parentId,
					text: content,
					author: user.name,
					mail: user.email,
					url: user.url,
				});
				setContent("");
				localStorage.removeItem(draftKey);
				onSuccess?.();
			} catch (e) {
				console.error(e);
			}
		});
	};

	return (
		<div className="relative mt-2 w-full">
			<fieldset className="group relative flex flex-col gap-0 border-none p-0 m-0">
				{/* Expanding Corners */}
				<span className="absolute z-10 top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-border transition-all duration-300 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-primary pointer-events-none rounded-tl-sm" />
				<span className="absolute z-10 top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-border transition-all duration-300 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-primary pointer-events-none rounded-tr-sm" />
				<span className="absolute z-10 bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-border transition-all duration-300 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-primary pointer-events-none rounded-bl-sm" />
				<span className="absolute z-10 bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-border transition-all duration-300 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-primary pointer-events-none rounded-br-sm" />

				{/* Input */}
				<div className="flex flex-col min-h-20 py-3 px-4">
					{!preview
						? (
								<textarea
									ref={textareaRef}
									value={content}
									onChange={e => setContent(e.target.value)}
									placeholder={parentId ? "回复..." : "发表友善的评论..."}
									className="grow w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none resize-y min-h-[60px] max-h-[400px] disabled:opacity-50"
									disabled={isPending}
								/>
							)
						: (
								<div className="min-h-16">
									{content.trim()
										? <CommentMarkdown content={content} />
										: <span className="text-muted-foreground/50 italic text-sm">暂无内容</span>}
								</div>
							)}
				</div>

				{/* Toolbar */}
				<div className="flex flex-wrap items-center gap-3 px-4 pb-3">
					<div className="relative" ref={emojiContainerRef}>
						<button type="button" onClick={toggleEmoji} className="text-muted-foreground hover:text-primary transition-colors flex items-center cursor-pointer">
							<Icon icon="mingcute:emoji-line" width="20" height="20" />
						</button>
						<AnimatePresence>
							{showEmoji && owoData && (
								<motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 mb-3 w-[300px] bg-background border border-border rounded-lg shadow-xl z-50 p-2">
									<div className="flex gap-2 overflow-x-auto pb-2 border-b border-border scrollbar-none mb-2">
										{Object.keys(owoData).map(pkg => (
											<button key={pkg} type="button" onClick={() => setActivePkg(pkg)} className={cn("text-[10px] px-2 py-0.5 rounded whitespace-nowrap", activePkg === pkg ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{pkg}</button>
										))}
									</div>
									<div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
										{owoData[activePkg]?.container.map(item => (
											<button
												key={`${activePkg}-${item.text}`}
												type="button"
												onClick={() => insertEmoji(item)}
												className="relative w-full aspect-square flex items-center justify-center p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer group"
											>
												<img
													src={parseOwOIcon(item.icon)}
													alt={item.text}
													className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-110"
													loading="lazy"
												/>
											</button>
										))}
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					<div className="flex items-center gap-2">
						<VerticalSlider
							checked={preview}
							onChange={setPreview}
							size="sm"
							className="cursor-pointer"
						/>
						<span className="text-xs text-muted-foreground select-none">
							预览
						</span>
					</div>

					<div className="grow" />

					<div className="flex gap-3 text-xs">
						<input value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} placeholder="昵称" className="w-20 bg-transparent border-b border-border focus:border-primary outline-none text-center text-foreground placeholder:text-muted-foreground/50 transition-colors py-1" />
						<input value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} placeholder="邮箱" className="w-24 bg-transparent border-b border-border focus:border-primary outline-none text-center text-foreground placeholder:text-muted-foreground/50 transition-colors py-1" />
					</div>

					<div className="flex items-center gap-2">
						{onCancel && <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground font-medium">取消</button>}
						<button
							type="button"
							onClick={handleSubmit}
							disabled={isPending || !content.trim() || !user.name}
							className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-md hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
						>
							{isPending
								? <Icon icon="svg-spinners:ring-resize" />
								: (
										<>
											<Icon icon="mingcute:send-plane-fill" />
											<span>发送</span>
										</>
									)}
						</button>
					</div>
				</div>
			</fieldset>
		</div>
	);
}
