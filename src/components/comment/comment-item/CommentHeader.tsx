"use client";

import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { SmartDate } from "@/components/common/smart-date";
import { cn } from "@/lib/utils";
import { CommentState } from "@/types/api";

interface CommentHeaderProps {
	comment: Comment;
}

/**
 * 评论头部组件 - 显示头像、用户名、标签和时间
 */
export function CommentHeader({ comment }: CommentHeaderProps) {
	return (
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

					{/* 待审核状态 */}
					{comment.state === CommentState.PENDING && (
						<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-yellow-50 text-yellow-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="评论正在审核中">
							<Icon icon="mingcute:time-line" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
							<span className="hidden sm:inline">审核中</span>
						</span>
					)}
					{/* 垃圾评论状态 */}
					{comment.state === CommentState.SPAM && (
						<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-red-50 text-red-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="已被标记为垃圾评论">
							<Icon icon="mingcute:delete-2-line" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
							<span className="hidden sm:inline">垃圾</span>
						</span>
					)}
					{/* 私密评论 */}
					{comment.isWhispers && (
						<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-orange-50 text-orange-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="仅作者和管理员可见">
							<Icon icon="mingcute:eye-close-line" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
							<span className="hidden sm:inline">私密</span>
						</span>
					)}

					{/* OAuth 来源标识 - 统一 Badge 风格 */}
					{comment.source === "from_oauth_github" && (
						<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-muted text-muted-foreground px-1 rounded font-medium shrink-0" title="GitHub 登录">
							<Icon icon="mingcute:github-fill" className="w-3 h-3" />
							<span className="hidden sm:inline">GitHub</span>
						</span>
					)}
					{comment.source === "from_oauth_qq" && (
						<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-blue-50 text-blue-600 px-1 rounded font-medium shrink-0" title="QQ 登录">
							<Icon icon="mingcute:qq-fill" className="w-3 h-3" />
							<span className="hidden sm:inline">QQ</span>
						</span>
					)}
					{comment.source === "from_oauth_both" && (
						<span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-violet-50 text-violet-600 px-1 rounded font-medium shrink-0" title="多平台绑定">
							<Icon icon="mingcute:user-security-fill" className="w-3 h-3" />
							<span className="hidden sm:inline">ALL</span>
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<SmartDate date={comment.created} className="text-[10px] sm:text-xs text-muted-foreground" />
				</div>
			</dt>
		</div>
	);
}
