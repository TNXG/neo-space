import type { Comment } from "@/types/api";
import { Icon } from "@iconify/react";
import { CommentMarkdown } from "@/components/common/markdown/CommentMarkdown";
import { getComments } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CommentSectionLazy } from "./CommentSectionLazy";

interface CommentSectionServerProps {
	refId: string;
	refType: "posts" | "pages" | "notes";
}

/**
 * 服务端静态评论项组件
 * 仅用于 SEO，不包含交互功能
 */
function StaticCommentItem({
	comment,
	depth = 0,
}: {
	comment: Comment;
	depth?: number;
}) {
	const canNest = depth < 2;

	return (
		<div
			className={cn(
				"relative rounded-lg overflow-visible",
				canNest && "before:absolute before:content-[''] before:top-10 sm:before:top-12 before:left-3 sm:before:left-4 before:h-[calc(100%-1.5rem)] sm:before:h-[calc(100%-2rem)] before:w-[2px] before:bg-linear-to-b before:from-border before:to-transparent",
			)}
		>
			<dl className="relative flex flex-col gap-1.5 sm:gap-2 mt-4 sm:mt-6">
				{/* Header */}
				<dt className="flex items-center gap-2 sm:gap-3">
					<div className="relative shrink-0">
						{comment.avatar
							? (
									<img
										src={comment.avatar}
										alt={comment.author}
										className="size-7 sm:size-9 rounded-full object-cover ring-2 ring-background shadow-sm"
									/>
								)
							: (
									<div className="size-7 sm:size-9 rounded-full bg-primary-200 flex items-center justify-center ring-2 ring-background shadow-sm">
										<span className="text-xs sm:text-sm font-medium text-primary-600">
											{comment.author.charAt(0).toUpperCase()}
										</span>
									</div>
								)}
					</div>
					<div className="flex flex-col min-w-0">
						<span className="font-semibold text-foreground text-sm sm:text-base truncate">
							{comment.author}
						</span>
						<time className="text-[10px] sm:text-xs text-muted-foreground">
							{new Date(comment.created).toLocaleDateString("zh-CN", {
								year: "numeric",
								month: "short",
								day: "numeric",
							})}
						</time>
					</div>
				</dt>

				{/* Content */}
				<blockquote className="ml-9 sm:ml-11">
					<div className="prose prose-sm prose-stone max-w-none text-foreground/90 leading-relaxed text-sm sm:text-base">
						<CommentMarkdown content={comment.text} />
					</div>
				</blockquote>
			</dl>

			{/* 子评论 */}
			{comment.children && comment.children.length > 0 && (
				<div className={cn("flex flex-col", canNest && "ml-5 sm:ml-7")}>
					{comment.children.map(child => (
						<StaticCommentItem
							key={child._id}
							comment={child}
							depth={canNest ? depth + 1 : depth}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * 静态评论列表组件
 * 服务端渲染，用于 SEO
 */
function StaticCommentList({ comments }: { comments: Comment[] }) {
	if (comments.length === 0) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				暂无评论，来抢沙发吧~
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{comments.map(comment => (
				<StaticCommentItem key={comment._id} comment={comment} />
			))}
		</div>
	);
}

/**
 * 服务器端评论组件
 * 初始渲染静态评论列表（SEO 友好），客户端加载后替换为交互组件
 *
 * @param props - 组件属性
 * @param props.refId - 关联内容的 ID
 * @param props.refType - 关联内容的类型
 */
export async function CommentSectionServer({
	refId,
	refType,
}: CommentSectionServerProps) {
	let initialComments: Comment[] = [];
	let initialCount = 0;

	try {
		const response = await getComments(refId, refType);

		if (response.status === "success" && response.data) {
			initialComments = response.data.comments || [];
			initialCount = response.data.count || 0;
		}
	} catch (error) {
		console.error("Failed to fetch comments on server:", error);
	}

	// 按时间排序（最新优先）
	const sortedComments = [...initialComments].sort((a, b) => {
		return new Date(b.created).getTime() - new Date(a.created).getTime();
	});

	return (
		<section className="mt-12 sm:mt-24 max-w-3xl mx-auto px-3 sm:px-4 md:px-0">
			{/* 标题 - 服务端渲染 */}
			<div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
				<h2 className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-2xl font-bold tracking-tight text-primary-900">
					<Icon icon="mingcute:message-3-line" className="w-5 h-5 sm:w-6 sm:h-6 text-accent-500 shrink-0" />
					<span>评论</span>
					<span className="text-sm sm:text-base font-normal text-primary-400 ml-0.5 sm:ml-1">
						(
						{initialCount}
						)
					</span>
				</h2>
			</div>

			{/*
				客户端交互组件 - 懒加载
				ssr: false 意味着服务端渲染时这里是空的，
				但下面的 StaticCommentList 会在服务端渲染，供 SEO 抓取
			*/}
			<CommentSectionLazy
				refId={refId}
				refType={refType}
				initialComments={initialComments}
				initialCount={initialCount}
			/>

			{/*
				静态评论列表 - 服务端渲染
				这部分会被搜索引擎抓取，客户端 JS 加载后会被 CommentSection 覆盖
				使用 CSS 隐藏，但保留在 DOM 中供 SEO
			*/}
			<div className="hidden" suppressHydrationWarning>
				<StaticCommentList comments={sortedComments} />
			</div>
		</section>
	);
}
