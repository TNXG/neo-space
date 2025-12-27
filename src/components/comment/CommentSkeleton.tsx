/**
 * 评论骨架屏组件
 * 用于 Suspense fallback，提供加载状态的视觉反馈
 */
export function CommentSkeleton() {
	return (
		<section className="mt-12 sm:mt-24 max-w-3xl mx-auto px-3 sm:px-4 md:px-0">
			{/* 标题骨架 */}
			<div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
				<div className="flex items-center gap-1.5 sm:gap-2">
					<div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary-200 rounded animate-pulse shrink-0" />
					<div className="h-6 sm:h-8 w-16 bg-primary-200 rounded animate-pulse" />
					<div className="h-5 sm:h-6 w-8 bg-primary-200 rounded animate-pulse ml-0.5 sm:ml-1" />
				</div>
				<div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-lg bg-primary-100 shrink-0">
					<div className="w-12 sm:w-16 h-7 sm:h-8 bg-primary-200 rounded-md animate-pulse" />
					<div className="w-12 sm:w-16 h-7 sm:h-8 bg-primary-200 rounded-md animate-pulse" />
				</div>
			</div>

			{/* 评论表单骨架 */}
			<div className="mb-8 sm:mb-12 p-4 sm:p-6 rounded-2xl bg-glass backdrop-blur-md border border-primary-200">
				<div className="space-y-4">
					<div className="h-10 bg-primary-200 rounded-lg animate-pulse" />
					<div className="h-10 bg-primary-200 rounded-lg animate-pulse" />
					<div className="h-24 bg-primary-200 rounded-lg animate-pulse" />
					<div className="flex justify-end">
						<div className="h-10 w-20 bg-primary-200 rounded-lg animate-pulse" />
					</div>
				</div>
			</div>

			{/* 评论列表骨架 */}
			<div className="space-y-4">
				{[1, 2, 3].map(i => (
					<div
						key={i}
						className="p-4 sm:p-6 rounded-2xl bg-glass backdrop-blur-md border border-primary-200"
					>
						<div className="flex items-start gap-3 sm:gap-4">
							<div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-200 rounded-full animate-pulse shrink-0" />
							<div className="flex-1 space-y-3">
								<div className="flex items-center gap-2">
									<div className="h-5 w-24 bg-primary-200 rounded animate-pulse" />
									<div className="h-4 w-32 bg-primary-200 rounded animate-pulse" />
								</div>
								<div className="space-y-2">
									<div className="h-4 w-full bg-primary-200 rounded animate-pulse" />
									<div className="h-4 w-3/4 bg-primary-200 rounded animate-pulse" />
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
