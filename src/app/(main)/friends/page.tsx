import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Constellation | 友链",
	description: "星座图谱，连接志同道合的朋友",
};

/**
 * 友链页面 - 施工中状态
 * 设计风格与 posts/notes 页面保持一致
 */
export default function FriendsPage() {
	return (
		<main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
			{/* 页面头部 - 与 posts/notes 风格一致 */}
			<header className="mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
				{/* 主标题区域 */}
				<div className="mb-4 md:mb-6 flex flex-col items-center">
					<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-r from-accent-600 to-primary-700 bg-clip-text text-transparent leading-tight py-2 select-none">
						星 座
					</h1>
					<span className="text-xs md:text-sm lg:text-base font-medium tracking-[0.3em] text-primary-500/60 uppercase mt-1 font-mono">
						Constellation
					</span>
				</div>

				{/* 副标题区域 */}
				<div className="text-primary-600 font-medium flex items-center justify-center gap-3 md:gap-4 w-full">
					<span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70"></span>
					<div className="flex flex-col items-center justify-center text-center">
						<span className="text-base md:text-lg lg:text-xl tracking-wide text-primary-700">
							以光为线，连接彼此
						</span>
						<span className="text-[11px] md:text-xs lg:text-sm text-primary-400/80 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
							Connected by starlight
						</span>
					</div>
					<span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70"></span>
				</div>
			</header>

			{/* 施工中内容区域 */}
			<div className="flex flex-col items-center justify-center">
				{/* 玻璃拟态卡片 */}
				<div className="glass-card w-full max-w-md p-8 md:p-10 text-center">
					{/* 施工图标 */}
					<div className="relative mb-6 flex justify-center">
						<div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-accent-100/50 dark:bg-accent-900/30 flex items-center justify-center">
							<svg
								className="w-10 h-10 md:w-12 md:h-12 text-accent-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="1.5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
								/>
							</svg>
						</div>
						{/* 装饰性脉冲圆环 */}
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
							<div className="w-20 h-20 md:w-24 md:h-24 rounded-full border border-accent-400/30 animate-pulse-ring"></div>
							<div className="absolute w-20 h-20 md:w-24 md:h-24 rounded-full border border-accent-400/20 animate-pulse-ring-delayed"></div>
						</div>
					</div>

					{/* 状态文字 */}
					<h2 className="text-xl md:text-2xl font-bold text-primary-800 dark:text-primary-200 mb-2">
						正在施工中
					</h2>
					<p className="text-sm md:text-base text-muted-foreground mb-6 leading-relaxed">
						友链页面正在精心打造中
						<br />
						敬请期待
					</p>

					{/* 装饰分割点 */}
					<div className="flex justify-center gap-2 py-4 opacity-50">
						<span className="w-1 h-1 rounded-full bg-accent-400"></span>
						<span className="w-1 h-1 rounded-full bg-accent-400"></span>
						<span className="w-1 h-1 rounded-full bg-accent-400"></span>
					</div>

					{/* 预期功能 */}
					<div className="text-center">
						<p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-mono">
							Coming Soon
						</p>
						<div className="flex flex-wrap justify-center gap-2">
							{["友链展示", "申请入口", "状态监控"].map((feature) => (
								<span
									key={feature}
									className="px-3 py-1.5 bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-400 rounded-full text-xs font-medium"
								>
									{feature}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
