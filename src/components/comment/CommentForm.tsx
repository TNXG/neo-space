"use client";

import type {
	CommentFormProps,
	GuestUser,
	OwOItem,
	OwOResponse,
	TurnstileStatusType,
} from "./comment-form";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createCommentAction } from "@/actions/comment";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { useHasMounted } from "@/hook/use-has-mounted";
import { createAuthComment } from "@/lib/api-client";
import { getUAInfo } from "@/lib/parse";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import {
	AuthenticatedUser,
	CornerBorders,
	GuestActions,
	OWO_API,
	parseOwOIcon,
	STORAGE_KEY_DRAFT_PREFIX,
	STORAGE_KEY_USER,
	ToolbarLeft,
} from "./comment-form";
import { useCommentRefresh } from "./hooks";
import { TurnstileWidget } from "./TurnstileWidget";

export type { CommentFormProps };

export function CommentForm({
	refId,
	refType,
	parentId,
	onSuccess,
	onCancel: _onCancel,
	autoFocus = false,
}: CommentFormProps) {
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
	const [activePopover, setActivePopover] = useState<"profile" | null>(null);
	const [preview, setPreview] = useState(false);

	// Turnstile 验证状态（仅非登录用户需要）
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatusType>("loading");
	const [turnstileResetTrigger, setTurnstileResetTrigger] = useState(0);

	// OwO State
	const [owoData, setOwoData] = useState<OwOResponse | null>(null);
	const [activePkg, setActivePkg] = useState<string>("");

	// Guest User Info
	const [user, setUser] = useState<GuestUser>({ name: "", email: "", url: "" });
	const [content, setContent] = useState("");
	const isRestoredRef = useRef(false);

	// 重置 Turnstile 验证
	const resetTurnstile = useCallback(() => {
		setTurnstileToken(null);
		setTurnstileStatus("verifying");
		setTurnstileResetTrigger(prev => prev + 1);
	}, []);

	// 客户端挂载后从 localStorage 恢复数据
	useEffect(() => {
		if (!hasMounted || isRestoredRef.current)
			return;
		isRestoredRef.current = true;

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

	// 自动聚焦
	useEffect(() => {
		if (hasMounted && autoFocus && textareaRef.current) {
			textareaRef.current.focus();
			const timer = setTimeout(() => setIsFocused(true), 0);
			return () => clearTimeout(timer);
		}
	}, [hasMounted, autoFocus]);

	// 草稿保存
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

	// 点击外部关闭
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				// 如果有任何弹窗打开（ProfilePopover 或表情选择器），不关闭评论栏
				if (activePopover || showEmoji) {
					return;
				}
				
				if (!content.trim()) {
					setIsFocused(false);
				}
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [content, activePopover, showEmoji]);

	// 自动调整高度
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [content]);

	// --- Handlers ---
	const handleEmojiOpenChange = useCallback((open: boolean) => {
		if (open) {
			// 关闭 ProfilePopover
			setActivePopover(null);
			if (!owoData) {
				fetch(OWO_API).then(r => r.json()).then((d) => {
					setOwoData(d);
					setActivePkg(Object.keys(d)[0]);
				});
			}
		}
		setShowEmoji(open);
	}, [owoData]);

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

		// 非登录用户必须完成人机验证
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

				if (result && "code" in result && (result.code === 200 || result.code === 201)) {
					const message = (result && "message" in result ? result.message : undefined) || "评论发布成功";
					const isPendingReview = message.includes("审核");

					if (isPendingReview) {
						toast.success("评论已提交，正在审核中", {
							description: "审核通过后将自动显示",
							duration: 4000,
						});
					} else {
						toast.success("评论发布成功");
					}

					setContent("");
					resetTurnstile();
					localStorage.removeItem(draftKey);
					setIsFocused(false);
					onSuccess?.();
				} else {
					throw new Error((result && "message" in result ? result.message : undefined) || "发布失败");
				}
			} catch (e: any) {
				toast.error(e.message || "发布失败");
				resetTurnstile();
			}
		});
	};

	const canSubmit = !isPending && content.trim().length > 0;
	const showToolbar = hasMounted && (isFocused || content.length > 0);

	return (
		<div className="relative mt-4 w-full overflow-visible">
			<fieldset
				ref={containerRef}
				className={cn(
					"group relative flex flex-col gap-0 border-none p-0 m-0 overflow-visible",
				)}
			>
				{/* 四角点线动画 */}
				<CornerBorders />

				{/* 编辑区 */}
				<div className="flex flex-col min-h-16 sm:min-h-20 py-2.5 sm:py-3 px-3 sm:px-4 relative z-0">
					{preview
						? (
								<div className="min-h-[50px] sm:min-h-[60px] prose prose-sm prose-stone max-w-none animate-fade-in">
									{content.trim()
										? <CommentMarkdown content={content} />
										: <span className="text-muted-foreground/40 italic">预览中...</span>}
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

				{/* Turnstile 人机验证 - 非交互式模式 */}
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
						{/* 左侧功能区 */}
						<ToolbarLeft
							showEmoji={showEmoji}
							onEmojiOpenChange={handleEmojiOpenChange}
							owoData={owoData}
							activePkg={activePkg}
							onPackageChange={setActivePkg}
							onEmojiSelect={insertEmoji}
							preview={preview}
							onPreviewChange={setPreview}
							contentLength={content.length}
							showTurnstile={hasMounted && !isAuthenticated && showToolbar}
							turnstileStatus={turnstileStatus}
						/>

						<div className="grow hidden sm:block" />

						{/* 右侧功能区：身份 + 按钮 */}
						<AnimatePresence mode="wait">
							{isAuthenticated && authUser
								? (
										<AuthenticatedUser
											user={authUser}
											isProfileOpen={activePopover === "profile"}
											onProfileOpenChange={(open) => {
												setActivePopover(open ? "profile" : null);
											}}
											onAvatarChange={refreshComments || undefined}
											onSubmit={handleSubmit}
											canSubmit={canSubmit}
											isPending={isPending}
										/>
									)
								: (
										<GuestActions
											user={user}
											onUserChange={setUser}
											onSubmit={handleSubmit}
											canSubmit={canSubmit}
											isPending={isPending}
										/>
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
