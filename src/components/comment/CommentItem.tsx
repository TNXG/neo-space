"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { SmartDate } from "@/components/common/smart-date";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { VerticalSlider } from "@/components/ui/toggle-switch";
import { deleteAuthComment, hideComment, pinComment, showComment, unpinComment, updateAuthComment } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { CommentForm } from "./CommentForm";
import { useCommentHighlight } from "./hooks";

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

interface CommentItemProps {
	comment: Comment;
	refId: string;
	refType: "posts" | "pages" | "notes";
	onRefresh: () => void;
	depth?: number;
	parentAuthor?: string;
	parentId?: string;
}

const MAX_DEPTH = 2; // 最多显示3层（0, 1, 2）

export function CommentItem({
	comment,
	refId,
	refType,
	onRefresh,
	depth = 0,
	parentAuthor,
	parentId,
}: CommentItemProps) {
	const [replyView, setReplyView] = useState(false);
	const [editView, setEditView] = useState(false);
	const [editPreview, setEditPreview] = useState(false);
	const [showEditEmoji, setShowEditEmoji] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.text);
	const [owoData, setOwoData] = useState<OwOResponse | null>(null);
	const [activePkg, setActivePkg] = useState<string>("");
	const itemRef = useRef<HTMLDivElement>(null);
	const editTextareaRef = useRef<HTMLTextAreaElement>(null);

	// 是否还能继续嵌套（depth < MAX_DEPTH 时可以嵌套）
	const canNest = depth < MAX_DEPTH;
	const showLine = canNest;

	// 认证状态
	const { user: authUser, isAuthenticated, token } = useAuthStore();

	// 判断是否为当前用户的评论（通过邮箱匹配）
	const isOwnComment = isAuthenticated && authUser && comment.author === authUser.name;

	// 判断当前用户是否为管理员
	const isCurrentUserAdmin = isAuthenticated && authUser?.isOwner;

	// 【关键修改】：使用 Context 获取全局高亮状态
	const { highlightedId, triggerHighlight } = useCommentHighlight();

	// 处理删除评论
	const handleDelete = () => {
		if (!token) {
			return;
		}

		// 使用 toast 替代 confirm
		toast("确定要删除这条评论吗？", {
			action: {
				label: "确认删除",
				onClick: async () => {
					setIsDeleting(true);
					try {
						const result = await deleteAuthComment(comment._id, token);
						if (result.code === 200) {
							toast.success("评论删除成功");
							onRefresh();
						} else {
							toast.error(result.message || "删除失败");
						}
					} catch (error) {
						console.error("Failed to delete comment:", error);
						toast.error("删除失败，请稍后重试");
					} finally {
						setIsDeleting(false);
					}
				},
			},
			cancel: {
				label: "取消",
				onClick: () => {},
			},
		});
	};

	// 处理编辑评论
	const handleEdit = () => {
		setEditView(true);
		setEditContent(comment.text);
		setEditPreview(false);
		if (replyView)
			setReplyView(false); // 关闭回复模式
	};

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
		if (!token || !editContent.trim()) {
			return;
		}

		setIsEditing(true);
		try {
			const result = await updateAuthComment(comment._id, { text: editContent.trim() }, token);
			if (result.code === 200) {
				toast.success("评论更新成功");
				setEditView(false);
				setEditPreview(false);
				onRefresh();
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
		// 如果内容有变化，询问用户是否确定取消
		if (editContent.trim() !== comment.text.trim()) {
			toast("确定要取消编辑吗？未保存的更改将丢失。", {
				action: {
					label: "确定取消",
					onClick: () => {
						setEditView(false);
						setEditContent(comment.text);
						setEditPreview(false);
					},
				},
				cancel: {
					label: "继续编辑",
					onClick: () => {},
				},
			});
		} else {
			setEditView(false);
			setEditContent(comment.text);
			setEditPreview(false);
		}
	};

	// 处理隐藏/显示评论（管理员功能）
	const handleToggleHidden = async () => {
		if (!token || !isCurrentUserAdmin)
			return;

		const action = comment.isWhispers ? "显示" : "隐藏";
		toast(`确定要${action}这条评论吗？`, {
			action: {
				label: `确认${action}`,
				onClick: async () => {
					try {
						const result = comment.isWhispers
							? await showComment(comment._id, token)
							: await hideComment(comment._id, token);

						if (result.code === 200) {
							toast.success(`评论${action}成功`);
							onRefresh();
						} else {
							toast.error(result.message || `${action}失败`);
						}
					} catch (error) {
						console.error(`Failed to ${action} comment:`, error);
						toast.error(`${action}失败，请稍后重试`);
					}
				},
			},
			cancel: {
				label: "取消",
				onClick: () => {},
			},
		});
	};

	// 处理置顶/取消置顶评论（管理员功能）
	const handleTogglePin = async () => {
		if (!token || !isCurrentUserAdmin)
			return;

		const action = comment.pin ? "取消置顶" : "置顶";
		toast(`确定要${action}这条评论吗？`, {
			action: {
				label: `确认${action}`,
				onClick: async () => {
					try {
						const result = comment.pin
							? await unpinComment(comment._id, token)
							: await pinComment(comment._id, token);

						if (result.code === 200) {
							toast.success(`评论${action}成功`);
							onRefresh();
						} else {
							toast.error(result.message || `${action}失败`);
						}
					} catch (error) {
						console.error(`Failed to ${action} comment:`, error);
						toast.error(`${action}失败，请稍后重试`);
					}
				},
			},
			cancel: {
				label: "取消",
				onClick: () => {},
			},
		});
	};

	// 判断当前组件是否应该高亮
	const isHighlighting = highlightedId === comment._id;

	// 处理点击 @ 回复对象
	const handleReplyClick = () => {
		if (!parentId)
			return;
		// 直接调用 Context 方法，不操作 DOM 属性
		triggerHighlight(parentId);
	};

	return (
		<motion.div
			ref={itemRef}
			id={comment._id}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
			className={cn(
				"relative group/item rounded-lg overflow-visible",
				showLine && "before:absolute before:content-[''] before:top-10 sm:before:top-12 before:left-3 sm:before:left-4 before:h-[calc(100%-1.5rem)] sm:before:h-[calc(100%-2rem)] before:w-[2px] before:bg-linear-to-b before:from-border before:to-transparent",
			)}
		>
			{/* 评论内容区域 */}
			<dl className="relative flex flex-col gap-1.5 sm:gap-2 mt-4 sm:mt-6">
				{/* 高亮层 - 完全由 isHighlighting 状态控制 */}
				<AnimatePresence>
					{isHighlighting && (
						<motion.div
							key="highlight-overlay"
							initial={{ opacity: 0 }}
							animate={{ opacity: [0, 1, 1, 0] }}
							exit={{ opacity: 0 }}
							transition={{
								duration: 3,
								times: [0, 0.05, 0.4, 1],
								ease: "easeInOut",
							}}
							className="absolute -inset-1.5 sm:-inset-2 rounded-lg pointer-events-none bg-primary/20 shadow-[0_0_0_4px_rgba(45,212,191,0.25)]"
						/>
					)}
				</AnimatePresence>

				{/* Header: 头像 + 信息 */}
				<div className="flex items-start sm:items-center gap-2 relative z-10">
					<img
						src={comment.avatar || `https://ui-avatars.com/api/?name=${comment.author}&background=random`}
						alt={comment.author}
						className={cn(
							"w-7 h-7 sm:w-9 sm:h-9 border rounded-full bg-background object-cover shrink-0",
							comment.isAdmin ? "border-green-500 ring-2 ring-green-500/20" : "border-border",
						)}
					/>

					<dt className="flex flex-col gap-0.5 min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
							<b className={cn("truncate max-w-[100px] sm:max-w-none", comment.isAdmin ? "text-green-700" : "text-foreground")}>
								{comment.author}
							</b>
							{comment.isAdmin && (
								<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-green-50 text-green-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="笔者">
									<Icon icon="mingcute:check-circle-fill" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
									<span className="hidden sm:inline">笔者</span>
								</span>
							)}
							<span className="text-[9px] sm:text-[10px] bg-muted text-muted-foreground px-1 rounded font-mono shrink-0">
								{comment.key}
							</span>
							{comment.pin && <Icon icon="mingcute:pin-fill" className="text-red-500 w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />}
							{comment.isWhispers && (
								<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-orange-50 text-orange-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="仅作者和管理员可见">
									<Icon icon="mingcute:eye-close-line" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
									<span className="hidden sm:inline">私密</span>
								</span>
							)}
							{/* OAuth 来源标识 */}
							{comment.source === "from_oauth_github" && (
								<span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-[#24292e] text-white px-1 sm:px-1.5 py-0.5 rounded shrink-0" title="通过 GitHub 登录">
									<Icon icon="mingcute:github-fill" className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
								</span>
							)}
							{comment.source === "from_oauth_qq" && (
								<span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-[#12b7f5] text-white px-1 sm:px-1.5 py-0.5 rounded shrink-0" title="通过 QQ 登录">
									<Icon icon="mingcute:qq-fill" className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
								</span>
							)}
						</div>
						<div className="flex items-center gap-1">
							<SmartDate date={comment.created} className="text-[10px] sm:text-xs text-muted-foreground" />
						</div>
					</dt>
				</div>

				{/* Content */}
				<blockquote className="ml-9 sm:ml-11">
					{parentAuthor && parentId && depth >= 1 && (
						<motion.button
							type="button"
							onClick={handleReplyClick}
							whileHover={{ x: 2 }}
							whileTap={{ scale: 0.98 }}
							className="flex items-center gap-1 mb-1 text-[11px] sm:text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer group/reply"
						>
							<Icon icon="mingcute:share-forward-line" className="group-hover/reply:translate-x-0.5 transition-transform size-3 sm:size-3.5" />
							<span>回复</span>
							<span className="font-bold text-foreground group-hover/reply:text-primary truncate max-w-[80px] sm:max-w-none">
								@
								{parentAuthor}
							</span>
						</motion.button>
					)}

					{editView
						? (
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
													<VerticalSlider
														checked={editPreview}
														onChange={setEditPreview}
														size="sm"
														className="cursor-pointer"
													/>
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
														disabled={
															isEditing
															|| !editContent.trim()
															|| editContent.trim() === comment.text.trim()
															|| editContent.length > 1000
														}
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
							)
						: (
								<div className="prose prose-sm prose-stone max-w-none text-foreground/90 leading-relaxed text-sm sm:text-base">
									<CommentMarkdown content={comment.text} />
								</div>
							)}

					<dd className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
						<motion.button
							type="button"
							onClick={() => {
								setReplyView(!replyView);
								if (editView)
									setEditView(false); // 关闭编辑模式
							}}
							disabled={editView}
							whileHover={{ scale: editView ? 1 : 1.05 }}
							whileTap={{ scale: editView ? 1 : 0.95 }}
							className={cn(
								"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
								editView
									? "text-muted-foreground/50 cursor-not-allowed"
									: replyView
										? "text-primary hover:text-primary"
										: "text-muted-foreground hover:text-primary",
							)}
						>
							<Icon icon="mingcute:share-forward-line" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
							<span>回复</span>
						</motion.button>

						{/* 当前用户的评论显示删除/编辑按钮 */}
						{isOwnComment && (
							<>
								<motion.button
									type="button"
									onClick={handleEdit}
									disabled={editView}
									whileHover={{ scale: editView ? 1 : 1.05 }}
									whileTap={{ scale: editView ? 1 : 0.95 }}
									className={cn(
										"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
										editView
											? "text-blue-500 cursor-default"
											: "text-muted-foreground hover:text-blue-500",
									)}
								>
									<Icon icon="mingcute:edit-line" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
									<span>{editView ? "编辑中" : "编辑"}</span>
								</motion.button>

								<motion.button
									type="button"
									onClick={handleDelete}
									disabled={isDeleting || editView}
									whileHover={{ scale: (isDeleting || editView) ? 1 : 1.05 }}
									whileTap={{ scale: (isDeleting || editView) ? 1 : 0.95 }}
									className={cn(
										"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors",
										(isDeleting || editView)
											? "text-muted-foreground/50 cursor-not-allowed opacity-50"
											: "text-muted-foreground hover:text-red-500 cursor-pointer",
									)}
								>
									<Icon icon={isDeleting ? "mingcute:loading-line" : "mingcute:delete-line"} className={`w-3.5 h-3.5 sm:w-4 sm:h-4${isDeleting ? " animate-spin" : ""}`} />
									<span>{isDeleting ? "删除中..." : "删除"}</span>
								</motion.button>
							</>
						)}

						{/* 管理员操作按钮 */}
						{isCurrentUserAdmin && (
							<>
								<motion.button
									type="button"
									onClick={handleToggleHidden}
									disabled={editView}
									whileHover={{ scale: editView ? 1 : 1.05 }}
									whileTap={{ scale: editView ? 1 : 0.95 }}
									className={cn(
										"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
										editView
											? "text-muted-foreground/50 cursor-not-allowed"
											: comment.isWhispers
												? "text-orange-500 hover:text-orange-600"
												: "text-muted-foreground hover:text-orange-500",
									)}
								>
									<Icon icon={comment.isWhispers ? "mingcute:eye-line" : "mingcute:eye-close-line"} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
									<span>{comment.isWhispers ? "显示" : "隐藏"}</span>
								</motion.button>

								<motion.button
									type="button"
									onClick={handleTogglePin}
									disabled={editView}
									whileHover={{ scale: editView ? 1 : 1.05 }}
									whileTap={{ scale: editView ? 1 : 0.95 }}
									className={cn(
										"flex items-center gap-1 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer",
										editView
											? "text-muted-foreground/50 cursor-not-allowed"
											: comment.pin
												? "text-red-500 hover:text-red-600"
												: "text-muted-foreground hover:text-red-500",
									)}
								>
									<Icon icon={comment.pin ? "mingcute:pin-fill" : "mingcute:pin-line"} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
									<span>{comment.pin ? "取消置顶" : "置顶"}</span>
								</motion.button>
							</>
						)}
					</dd>
				</blockquote>
			</dl>

			<div className={cn("flex flex-col", canNest && "ml-5 sm:ml-7")}>
				<AnimatePresence mode="wait">
					{replyView && (
						<motion.div
							initial={{ opacity: 0, height: 0, y: -10 }}
							animate={{ opacity: 1, height: "auto", y: 0 }}
							exit={{ opacity: 0, height: 0, y: -10 }}
							transition={{ duration: 0.3, ease: "easeInOut" }}
							className="mb-3 sm:mb-4 mt-1.5 sm:mt-2 overflow-visible"
						>
							<CommentForm
								refId={refId}
								refType={refType}
								parentId={comment._id}
								autoFocus
								onSuccess={() => {
									setReplyView(false);
									onRefresh();
								}}
								onCancel={() => setReplyView(false)}
							/>
						</motion.div>
					)}
				</AnimatePresence>

				{comment.children && comment.children.map(child => (
					<CommentItem
						key={child._id}
						comment={child}
						refId={refId}
						refType={refType}
						onRefresh={onRefresh}
						depth={canNest ? depth + 1 : depth}
						parentAuthor={comment.author}
						parentId={comment._id}
					/>
				))}
			</div>
		</motion.div>
	);
}
