"use client";

import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createCommentAction } from "@/actions/comment";
import { OAuthButtons } from "@/components/comment/auth/OAuthButtons";
import { ProfilePopover } from "@/components/comment/auth/ProfilePopover";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { KbdShortcut } from "@/components/ui/kbd";
import { VerticalSlider } from "@/components/ui/toggle-switch";
import { useHasMounted } from "@/hook/use-has-mounted";
import { createAuthComment } from "@/lib/api-client";
import { getUAInfo } from "@/lib/parse";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { useCommentRefresh } from "./hooks";
import { TurnstileWidget } from "./TurnstileWidget";

// --- Types ---
interface OwOItem { text: string; icon: string }
interface OwOPackage { type: string; container: OwOItem[] }
type OwOResponse = Record<string, OwOPackage>;

interface CommentFormProps {
	refId: string;
	refType: "posts" | "pages" | "notes";
	parentId?: string;
	onSuccess?: () => void;
	onCancel?: () => void;
	autoFocus?: boolean;
}

// --- Constants ---
const STORAGE_KEY_USER = "comment-user-data";
const STORAGE_KEY_DRAFT_PREFIX = "comment-draft-";
const OWO_API = "https://cdn.tnxg.top/images/face/owo.json";

// --- Utils ---
const parseOwOIcon = (iconString: string): string => {
	const match = iconString.match(/src="([^"]+)"/);
	return match && match[1] ? (match[1].startsWith("http") ? match[1] : `https://${match[1]}`) : "";
};

export function CommentForm({ refId, refType, parentId, onSuccess, onCancel: _onCancel, autoFocus = false }: CommentFormProps) {
	const hasMounted = useHasMounted();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const containerRef = useRef<HTMLFieldSetElement>(null);
	const [isPending, startTransition] = useTransition();

	// Global Auth State
	const { user: authUser, isAuthenticated, token } = useAuthStore();

	// Comment Refresh from Context
	const { refreshComments } = useCommentRefresh();

	// Local State
	const draftKey = `${STORAGE_KEY_DRAFT_PREFIX}${refId}-${parentId || "root"}`;
	const [isFocused, setIsFocused] = useState(false);
	const [showEmoji, setShowEmoji] = useState(false);
	const [activePopover, setActivePopover] = useState<"login" | "profile" | null>(null);

	// 新增：专门控制登录跳转时的加载状态
	const [isRedirecting, setIsRedirecting] = useState(false);

	const [preview, setPreview] = useState(false);

	// Turnstile 验证状态（仅非登录用户需要）
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const [turnstileStatus, setTurnstileStatus] = useState<"loading" | "verifying" | "verified" | "error">("loading");
	const [turnstileResetTrigger, setTurnstileResetTrigger] = useState(0);

	// 重置 Turnstile 验证
	const resetTurnstile = useCallback(() => {
		setTurnstileToken(null);
		setTurnstileStatus("verifying");
		setTurnstileResetTrigger(prev => prev + 1);
	}, []);

	// OwO State
	const [owoData, setOwoData] = useState<OwOResponse | null>(null);
	const [activePkg, setActivePkg] = useState<string>("");

	// Guest User Info - 初始化为空，客户端挂载后从 localStorage 读取
	const [user, setUser] = useState({ name: "", email: "", url: "" });

	// 评论内容 - 初始化为空，客户端挂载后从 localStorage 读取
	const [content, setContent] = useState("");

	// 标记是否已从 localStorage 恢复数据
	const isRestoredRef = useRef(false);

	// 客户端挂载后从 localStorage 恢复数据（只执行一次）
	useEffect(() => {
		if (!hasMounted || isRestoredRef.current)
			return;
		isRestoredRef.current = true;

		// 使用 requestAnimationFrame 延迟执行，避免 React 警告
		requestAnimationFrame(() => {
			try {
				const savedUser = localStorage.getItem(STORAGE_KEY_USER);
				if (savedUser) {
					setUser(JSON.parse(savedUser));
				}
				const savedDraft = localStorage.getItem(draftKey);
				if (savedDraft) {
					setContent(savedDraft);
				}
			} catch {
				// ignore
			}
		});
	}, [hasMounted, draftKey]);

	// --- Effects ---
	useEffect(() => {
		if (hasMounted && autoFocus && textareaRef.current) {
			textareaRef.current.focus();
			// 使用 setTimeout 避免直接在 useEffect 中调用 setState
			const timer = setTimeout(() => setIsFocused(true), 0);
			return () => clearTimeout(timer);
		}
	}, [hasMounted, autoFocus]);

	useEffect(() => {
		if (!hasMounted)
			return;
		const timer = setTimeout(() => {
			if (content) {
				localStorage.setItem(draftKey, content);
			} else {
				localStorage.removeItem(draftKey);
			}
		}, 500);
		return () => clearTimeout(timer);
	}, [content, hasMounted, draftKey]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				if (!content.trim()) {
					setIsFocused(false);
				}
				setShowEmoji(false);
				setActivePopover(null);
				// 如果关闭面板，重置跳转状态
				if (activePopover === "login") {
					setIsRedirecting(false);
				}
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [content, activePopover]);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [content]);

	// --- Handlers ---
	const toggleEmoji = useCallback(() => {
		setActivePopover(null);
		setShowEmoji((prev) => {
			if (!prev && !owoData) {
				fetch(OWO_API).then(r => r.json()).then((d) => {
					setOwoData(d);
					setActivePkg(Object.keys(d)[0]);
				});
			}
			return !prev;
		});
	}, [owoData]);

	const togglePopover = (type: "login" | "profile") => {
		setShowEmoji(false);
		if (activePopover === type) {
			setActivePopover(null);
			if (type === "login") {
				setIsRedirecting(false);
			}
		} else {
			setActivePopover(type);
			if (type === "login") {
				setIsRedirecting(false);
			}
		}
	};

	// 处理 OAuth 点击，捕获事件触发全局 Loading
	const handleOAuthClick = () => {
		// 不阻止默认行为，让 OAuthButtons 内部的跳转正常执行
		setIsRedirecting(true);
		// 延迟关闭弹窗，让用户看到加载状态
		setTimeout(() => {
			setActivePopover(null);
		}, 1500);
	};

	const insertEmoji = (item: OwOItem) => {
		const url = parseOwOIcon(item.icon);
		const input = textareaRef.current;
		if (!input)
			return;
		const start = input.selectionStart;
		const newContent = `${content.slice(0, start)}![${item.text}](${url}) ${content.slice(input.selectionEnd)}`;
		setContent(newContent);
		setShowEmoji(false);
		setTimeout(() => input.focus(), 0);
	};

	const handleSubmit = () => {
		const finalName = isAuthenticated ? authUser?.name : user.name;
		const finalEmail = isAuthenticated ? authUser?.email : user.email;
		const finalUrl = isAuthenticated ? "" : user.url;

		if (!content.trim())
			return;
		if (!finalName) {
			toast.error("请填写昵称");
			return;
		}

		// 非登录用户必须完成人机验证（非交互式模式会自动完成）
		if (!isAuthenticated && !turnstileToken) {
			if (turnstileStatus === "loading") {
				toast.error("正在加载验证组件，请稍候...");
			} else if (turnstileStatus === "verifying") {
				toast.error("正在进行安全验证，请稍候...");
			} else if (turnstileStatus === "error") {
				toast.error("安全验证失败，请刷新页面重试");
			} else {
				toast.error("请等待安全验证完成");
			}
			return;
		}

		if (!isAuthenticated) {
			localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
		}

		startTransition(async () => {
			try {
				// 获取 UA 信息
				const uaInfo = await getUAInfo();

				let result;
				if (isAuthenticated && token) {
					result = await createAuthComment({
						ref: refId,
						refType,
						parent: parentId,
						text: content,
						url: finalUrl,
						ua: uaInfo,
					}, token);
				} else {
					result = await createCommentAction({
						ref: refId,
						refType,
						parent: parentId,
						text: content,
						author: finalName || "",
						mail: finalEmail || "",
						url: finalUrl,
						turnstileToken: turnstileToken || undefined,
						ua: uaInfo,
					});
				}

				// 统一检查 code 属性（ApiResponse 类型有 code）
				if (result && "code" in result && (result.code === 200 || result.code === 201)) {
					// 根据返回的消息判断是否需要审核
					const message = (result && "message" in result ? result.message : undefined) || "评论发布成功";
					const isPending = message.includes("审核");

					if (isPending) {
						toast.success("评论已提交，正在审核中", {
							description: "审核通过后将自动显示",
							duration: 4000,
						});
					} else {
						toast.success("评论发布成功");
					}

					setContent("");
					resetTurnstile(); // 重置验证码
					localStorage.removeItem(draftKey);
					setIsFocused(false);
					onSuccess?.();
				} else {
					throw new Error((result && "message" in result ? result.message : undefined) || "发布失败");
				}
			} catch (e: any) {
				toast.error(e.message || "发布失败");
				// 提交失败后重置验证码
				resetTurnstile();
			}
		});
	};

	const canSubmit = !isPending && content.trim().length > 0;
	// 确保 showToolbar 在客户端挂载前为 false，避免 hydration 不匹配
	const showToolbar = hasMounted && (isFocused || content.length > 0);

	return (
		<div className="relative mt-4 w-full overflow-visible">
			<fieldset
				ref={containerRef}
				className={cn(
					"group relative flex flex-col gap-0 border-none p-0 m-0 overflow-visible",
				)}
			>
				{/* === 四角点线动画 (The Four Corners) === */}
				<span className="absolute z-10 top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-tl-sm" />
				<span className="absolute z-10 top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-tr-sm" />
				<span className="absolute z-10 bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-bl-sm" />
				<span className="absolute z-10 bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-br-sm" />

				{/* 编辑区 */}
				<div className="flex flex-col min-h-16 sm:min-h-20 py-2.5 sm:py-3 px-3 sm:px-4 relative z-0">
					{preview
						? (
								<div className="min-h-[50px] sm:min-h-[60px] prose prose-sm prose-stone max-w-none animate-fade-in">
									{content.trim() ? <CommentMarkdown content={content} /> : <span className="text-muted-foreground/40 italic">预览中...</span>}
								</div>
							)
						: (
								<textarea
									ref={textareaRef}
									value={content}
									onFocus={() => setIsFocused(true)}
									onChange={e => setContent(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
											e.preventDefault();
											handleSubmit();
										}
									}}
									placeholder={parentId ? "回复..." : "写下你的想法..."}
									className="grow w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 outline-none resize-y min-h-[50px] sm:min-h-[60px] max-h-[300px] sm:max-h-[400px] disabled:opacity-50"
									spellCheck={false}
									disabled={isPending}
								/>
							)}
				</div>

				{/* Turnstile 人机验证 - 非交互式模式（隐藏在后台） */}
				{!isAuthenticated && (
					<TurnstileWidget
						onVerify={token => setTurnstileToken(token)}
						onError={() => {
							toast.error("人机验证失败，请刷新重试");
							setTurnstileToken(null);
							setTurnstileStatus("error");
						}}
						onExpire={() => {
							toast.warning("验证已过期，请重新验证");
							setTurnstileToken(null);
							setTurnstileStatus("error");
						}}
						onStatusChange={status => setTurnstileStatus(status)}
						resetTrigger={turnstileResetTrigger}
					/>
				)}

				{/* 工具栏 */}
				<motion.div
					initial={false}
					animate={{
						height: showToolbar ? "auto" : 0,
						opacity: showToolbar ? 1 : 0,
					}}
					className="overflow-visible"
				>
					<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 pb-3 relative z-10">

						{/* 左侧功能区：表情 + 预览 */}
						<div className="flex items-center gap-3 sm:gap-4">
							<div className="relative">
								<button
									type="button"
									onClick={toggleEmoji}
									className={cn(
										"text-muted-foreground transition-colors flex items-center cursor-pointer hover:text-accent-600",
										showEmoji && "text-accent-600",
									)}
								>
									<Icon icon="mingcute:emoji-line" width="18" height="18" className="sm:w-5 sm:h-5" />
								</button>
								{/* Emoji Popover - 移动端全宽适配 */}
								<AnimatePresence>
									{showEmoji && owoData && (
										<motion.div
											initial={{ opacity: 0, y: 10, scale: 0.95 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 10, scale: 0.95 }}
											className="absolute bottom-full left-0 sm:left-0 mb-3 w-[calc(100vw-2rem)] sm:w-[300px] max-w-[300px] bg-background/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-glass z-50 p-2"
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
														onClick={() => insertEmoji(item)}
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
									checked={preview}
									onChange={setPreview}
									size="sm"
									className="cursor-pointer"
								/>
								<span className="text-[11px] sm:text-xs text-muted-foreground select-none">预览</span>
							</div>

							<span className="hidden md:inline">
								<KbdShortcut keys={["Ctrl", "Enter"]} />
							</span>

							{/* 字数统计 */}
							{content.length > 0 && (
								<span className={cn(
									"text-[10px] sm:text-xs font-mono tabular-nums",
									content.length > 1000 ? "text-red-500 font-semibold" : "text-muted-foreground",
								)}
								>
									{content.length}
									/1000
								</span>
							)}

							{/* 验证状态显示（仅非登录用户，客户端渲染） */}
							{hasMounted && !isAuthenticated && showToolbar && (
								<div className="flex items-center gap-1.5">
									{turnstileStatus === "loading" && (
										<>
											<Icon icon="mingcute:loading-line" className="w-3 h-3 text-muted-foreground animate-spin" />
											<span className="text-[10px] sm:text-xs text-muted-foreground">加载验证...</span>
										</>
									)}
									{turnstileStatus === "verifying" && (
										<>
											<Icon icon="mingcute:loading-line" className="w-3 h-3 text-blue-500 animate-spin" />
											<span className="text-[10px] sm:text-xs text-blue-600">安全验证中...</span>
										</>
									)}
									{turnstileStatus === "verified" && (
										<>
											<Icon icon="mingcute:check-circle-fill" className="w-3 h-3 text-green-500" />
											<span className="text-[10px] sm:text-xs text-green-600">验证通过</span>
										</>
									)}
									{turnstileStatus === "error" && (
										<>
											<Icon icon="mingcute:close-circle-fill" className="w-3 h-3 text-red-500" />
											<span className="text-[10px] sm:text-xs text-red-600">验证失败</span>
										</>
									)}
								</div>
							)}
						</div>

						<div className="grow hidden sm:block" />

						{/* 右侧功能区：身份 + 按钮 */}
						<AnimatePresence mode="wait">
							{isAuthenticated && authUser
								? (
										<motion.div
											key="logged-in"
											initial={{ opacity: 0, x: 10 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: -10 }}
											className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3"
										>
											<div className="relative">
												<button
													type="button"
													onClick={() => togglePopover("profile")}
													className={cn(
														"flex items-center gap-1.5 sm:gap-2 pl-0.5 sm:pl-1 pr-2 sm:pr-3 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer",
														activePopover === "profile"
															? "bg-accent-50 border-accent-200 ring-1 ring-accent-100"
															: "bg-transparent border-transparent hover:bg-primary-50 hover:border-primary-200",
													)}
												>
													<img src={authUser.image} alt={authUser.name} className="size-5 sm:size-6 rounded-full" />
													<span className="text-[11px] sm:text-xs font-medium text-foreground max-w-[60px] sm:max-w-[80px] truncate">{authUser.name}</span>
												</button>

												{/* 个人资料弹窗 */}
												<ProfilePopover
													isOpen={activePopover === "profile"}
													onClose={() => setActivePopover(null)}
													onAvatarChange={refreshComments || undefined}
												/>
											</div>
											<SubmitButton onClick={handleSubmit} disabled={!canSubmit} isPending={isPending} />
										</motion.div>
									)
								: (
										<motion.div
											key="guest"
											initial={{ opacity: 0, x: 10 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: -10 }}
											className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 w-full sm:w-auto"
										>
											{/* 输入框 - 移动端独占一行 */}
											<div className="flex items-center gap-2 w-full sm:w-auto">
												<input
													value={user.name}
													onChange={e => setUser({ ...user, name: e.target.value })}
													placeholder="昵称*"
													className="flex-1 sm:flex-initial sm:w-24 bg-transparent border-b border-border/50 focus:border-accent-500 rounded-none px-1 py-1 text-[11px] sm:text-xs outline-none transition-all placeholder:text-muted-foreground/50 text-center"
												/>
												<input
													value={user.email}
													onChange={e => setUser({ ...user, email: e.target.value })}
													placeholder="邮箱"
													className="flex-1 sm:flex-initial sm:w-32 bg-transparent border-b border-border/50 focus:border-accent-500 rounded-none px-1 py-1 text-[11px] sm:text-xs outline-none transition-all placeholder:text-muted-foreground/50 text-center"
												/>
											</div>

											{/* 登录按钮 + 发送按钮 */}
											<div className="flex items-center justify-end gap-1.5 sm:gap-2">
												<div className="relative">
													<button
														type="button"
														onClick={() => togglePopover("login")}
														className={cn(
															"p-1 sm:p-1.5 rounded-full transition-all cursor-pointer",
															activePopover === "login"
																? "text-accent-600 bg-accent-50"
																: "text-muted-foreground hover:text-accent-600 hover:bg-primary-50/50",
														)}
														title="登录"
													>
														<Icon icon="mingcute:user-3-line" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
													</button>

													{/* Login Popover - 移动端适配 */}
													<AnimatePresence>
														{activePopover === "login" && (
															<motion.div
																initial={{ opacity: 0, y: 10, scale: 0.95 }}
																animate={{ opacity: 1, y: 0, scale: 1 }}
																exit={{ opacity: 0, y: 10, scale: 0.95 }}
																className="absolute bottom-full right-0 mb-3 z-50 w-[220px] sm:w-[260px] bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-glass p-4 sm:p-6 overflow-hidden"
															>
																<div className="text-center mb-4 sm:mb-5">
																	<h3 className="font-serif text-lg sm:text-xl font-medium text-foreground">登录</h3>
																</div>

																{/* 如果正在跳转，显示全局 Loading；否则显示内容 */}
																{isRedirecting
																	? (
																			<motion.div
																				initial={{ opacity: 0 }}
																				animate={{ opacity: 1 }}
																				className="flex flex-col items-center justify-center py-4 sm:py-6 gap-2 sm:gap-3"
																			>
																				<Icon icon="mingcute:loading-line" className="size-6 sm:size-8 text-accent-500 animate-spin" />
																				<span className="text-[11px] sm:text-xs text-muted-foreground animate-pulse">正在前往登录...</span>
																			</motion.div>
																		)
																	: (
																			<motion.div
																				initial={{ opacity: 0 }}
																				animate={{ opacity: 1 }}
																			>
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

																				{/* OAuth 按钮 - 保持品牌色 */}
																				<div
																					className="flex flex-col gap-2 sm:gap-2.5"
																					onClick={handleOAuthClick}
																				>
																					<OAuthButtons variant="compact" className="flex-col" />
																				</div>

																				<button
																					type="button"
																					onClick={() => {
																						togglePopover("login");
																					}}
																					className="w-full mt-3 sm:mt-4 py-1 text-[11px] sm:text-xs text-muted-foreground/60 hover:text-foreground transition-colors bg-muted/30 rounded cursor-pointer"
																				>
																					取消
																				</button>
																			</motion.div>
																		)}
															</motion.div>
														)}
													</AnimatePresence>
												</div>

												<SubmitButton onClick={handleSubmit} disabled={!canSubmit} isPending={isPending} />
											</div>
										</motion.div>
									)}
						</AnimatePresence>
					</div>
				</motion.div>

				{!showToolbar && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.2 }}
						className="absolute bottom-3 right-4 pointer-events-none text-xs text-muted-foreground/40"
					>
						点击输入框展开
					</motion.div>
				)}
			</fieldset>
		</div>
	);
}

function SubmitButton({ onClick, disabled, isPending }: { onClick: () => void; disabled: boolean; isPending: boolean }) {
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
			{isPending ? <Icon icon="mingcute:loading-line" className="animate-spin size-3.5 sm:size-4" /> : <Icon icon="mingcute:send-plane-fill" className="size-3.5 sm:size-4" />}
			<span className="hidden sm:inline">发送</span>
		</button>
	);
}
