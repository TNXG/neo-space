"use client";

import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { VerticalSlider } from "@/components/ui/toggle-switch";
import { updateAuthComment } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// --- Types for Emoji ---
interface OwOItem { text: string; icon: string }
interface OwOPackage { type: string; container: OwOItem[] }
type OwOResponse = Record<string, OwOPackage>;

// --- Constants ---
const OWO_API = "https://cdn.tnxg.top/images/face/owo.json";

// --- Utils ---
const parseOwOIcon = (iconString: string): string => {
	const match = iconString.match(/src="([^"]+)"/);
	return match && match[1] ? (match[1].startsWith("http") ? match[1] : `https://${match[1]}`) : "";
};

interface CommentEditFormProps {
	commentId: string;
	originalText: string;
	token: string;
	onSave: () => void;
	onCancel: () => void;
}

/**
 * 评论编辑表单组件
 */
export function CommentEditForm({
	commentId,
	originalText,
	token,
	onSave,
	onCancel,
}: CommentEditFormProps) {
	const [editPreview, setEditPreview] = useState(false);
	const [showEditEmoji, setShowEditEmoji] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(originalText);
	const [owoData, setOwoData] = useState<OwOResponse | null>(null);
	const [activePkg, setActivePkg] = useState<string>("");
	const editTextareaRef = useRef<HTMLTextAreaElement>(null);

	// 处理编辑表情切换
	const toggleEditEmoji = () => {
		setShowEditEmoji((prev) => {
			if (!prev && !owoData) {
				fetch(OWO_API).then(r => r.json()).then((d) => {
					setOwoData(d);
					setActivePkg(Object.keys(d)[0]);
				});
			}
			return !prev;
		});
	};

	// 插入表情到编辑内容
	const insertEditEmoji = (item: OwOItem) => {
		const url = parseOwOIcon(item.icon);
		const textarea = editTextareaRef.current;
		if (!textarea)
			return;

		const start = textarea.selectionStart;
		const newContent = `${editContent.slice(0, start)}![${item.text}](${url}) ${editContent.slice(textarea.selectionEnd)}`;
		setEditContent(newContent);
		setShowEditEmoji(false);
		setTimeout(() => textarea.focus(), 0);
	};

	// 处理保存编辑
	const handleSaveEdit = async () => {
		if (!token || !editContent.trim())
			return;

		setIsEditing(true);
		try {
			const result = await updateAuthComment(commentId, { text: editContent.trim() }, token);
			if (result.code === 200) {
				toast.success("评论更新成功");
				onSave();
			} else {
				toast.error(result.message || "更新失败");
			}
		} catch (error) {
			console.error("Failed to update comment:", error);
			toast.error("更新失败，请稍后重试");
		} finally {
			setIsEditing(false);
		}
	};

	// 处理取消编辑
	const handleCancelEdit = () => {
		if (editContent.trim() !== originalText.trim()) {
			toast("确定要取消编辑吗？未保存的更改将丢失。", {
				action: {
					label: "确定取消",
					onClick: onCancel,
				},
				cancel: {
					label: "继续编辑",
					onClick: () => {},
				},
			});
		} else {
			onCancel();
		}
	};

	return (
		<div className="relative mt-2 w-full overflow-visible">
			<fieldset className="group relative flex flex-col gap-0 border-none p-0 m-0 overflow-visible">
				{/* === 四角点线动画 (The Four Corners) === */}
				<span className="absolute z-10 top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-tl-sm" />
				<span className="absolute z-10 top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-tr-sm" />
				<span className="absolute z-10 bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-bl-sm" />
				<span className="absolute z-10 bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-br-sm" />

				{/* 编辑区 */}
				<div className="flex flex-col min-h-16 sm:min-h-20 py-2.5 sm:py-3 px-3 sm:px-4 relative z-0">
					{editPreview
						? (
								<div className="min-h-[50px] sm:min-h-[60px] prose prose-sm prose-stone max-w-none animate-fade-in">
									{editContent.trim() ? <CommentMarkdown content={editContent} /> : <span className="text-muted-foreground/40 italic">预览中...</span>}
								</div>
							)
						: (
								<textarea
									ref={editTextareaRef}
									value={editContent}
									onChange={e => setEditContent(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Escape") {
											handleCancelEdit();
										} else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
											e.preventDefault();
											handleSaveEdit();
										}
									}}
									className="grow w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 outline-none resize-y min-h-[50px] sm:min-h-[60px] max-h-[300px] sm:max-h-[400px] disabled:opacity-50"
									placeholder="编辑你的评论..."
									disabled={isEditing}
									autoFocus
									spellCheck={false}
								/>
							)}
				</div>

				{/* 工具栏 */}
				<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 pb-3 relative z-10">
					{/* 左侧功能区：表情 + 预览 */}
					<div className="flex items-center gap-3 sm:gap-4">
						<div className="relative">
							<button
								type="button"
								onClick={toggleEditEmoji}
								className={cn(
									"text-muted-foreground transition-colors flex items-center cursor-pointer hover:text-accent-600",
									showEditEmoji && "text-accent-600",
								)}
							>
								<Icon icon="mingcute:emoji-line" width="18" height="18" className="sm:w-5 sm:h-5" />
							</button>
							{/* Emoji Popover */}
							<AnimatePresence>
								{showEditEmoji && owoData && (
									<motion.div
										initial={{ opacity: 0, y: 10, scale: 0.95 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										exit={{ opacity: 0, y: 10, scale: 0.95 }}
										className="absolute bottom-full left-0 mb-3 w-[calc(100vw-3rem)] sm:w-[300px] max-w-[300px] bg-background/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-glass z-50 p-2"
									>
										<div className="flex gap-2 overflow-x-auto pb-2 border-b border-border/50 scrollbar-none mb-2">
											{Object.keys(owoData).map(pkg => (
												<button key={pkg} type="button" onClick={() => setActivePkg(pkg)} className={cn("text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors", activePkg === pkg ? "bg-accent-100 text-accent-700 font-medium" : "text-muted-foreground hover:bg-muted")}>{pkg}</button>
											))}
										</div>
										<div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 sm:gap-2 max-h-32 sm:max-h-40 overflow-y-auto">
											{owoData[activePkg]?.container.map(item => (
												<button
													key={`${activePkg}-${item.text}`}
													type="button"
													onClick={() => insertEditEmoji(item)}
													className="relative w-full aspect-square flex items-center justify-center p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer group"
												>
													<img src={parseOwOIcon(item.icon)} alt={item.text} className="w-full h-full object-contain" loading="lazy" />
												</button>
											))}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>

						<div className="flex items-center gap-1.5 sm:gap-2">
							<VerticalSlider checked={editPreview} onChange={setEditPreview} size="sm" className="cursor-pointer" />
							<span className="text-[11px] sm:text-xs text-muted-foreground select-none">预览</span>
						</div>
					</div>

					<div className="grow hidden sm:block" />

					{/* 右侧功能区：快捷键提示 + 字符计数 + 按钮 */}
					<div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
						<KbdGroup className="hidden md:inline-flex">
							<Kbd>Ctrl</Kbd>
							<span className="text-primary-400 text-[10px]">+</span>
							<Kbd>Enter</Kbd>
							<span className="text-muted-foreground/60 text-[10px] sm:text-xs mx-1">保存</span>
							<Kbd>Esc</Kbd>
							<span className="text-muted-foreground/60 text-[10px] sm:text-xs ml-1">取消</span>
						</KbdGroup>

						<span className={cn(
							"text-[10px] sm:text-xs font-mono",
							editContent.length > 1000 ? "text-red-500" : "text-muted-foreground",
						)}
						>
							{editContent.length}
							/1000
						</span>

						<div className="flex items-center gap-1.5 sm:gap-2">
							<button
								type="button"
								onClick={handleSaveEdit}
								disabled={isEditing || !editContent.trim() || editContent.trim() === originalText.trim() || editContent.length > 1000}
								className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm h-7 sm:h-8 cursor-pointer bg-accent-600 text-white hover:bg-accent-500 hover:shadow-accent-500/20 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isEditing
									? (
											<Icon icon="mingcute:loading-line" className="animate-spin size-3.5 sm:size-4" />
										)
									: (
											<Icon icon="mingcute:check-line" className="size-3.5 sm:size-4" />
										)}
								<span className="hidden sm:inline">{isEditing ? "保存中..." : "保存"}</span>
							</button>

							<button
								type="button"
								onClick={handleCancelEdit}
								disabled={isEditing}
								className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm h-7 sm:h-8 cursor-pointer bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
							>
								<Icon icon="mingcute:close-line" className="size-3.5 sm:size-4" />
								<span className="hidden sm:inline">取消</span>
							</button>
						</div>
					</div>
				</div>
			</fieldset>
		</div>
	);
}
