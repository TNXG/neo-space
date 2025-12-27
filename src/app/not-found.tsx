import Link from "next/link";
import { useHasMounted } from "@/hook/use-has-mounted";

export async function generateStaticParams() {
	return [];
}

/**
 * 404 页面 - 星海迷航版 (移动端优化)
 * 优化点：
 * 1. 调整了移动端 padding 和字体大小，防止内容溢出
 * 2. 移动端按钮组强制撑满宽度，便于单手点击
 * 3. 优化了光晕在小屏幕上的尺寸
 */
export default function NotFound() {
	const mounted = useHasMounted();

	return (
		<div className="fixed inset-0 z-50 font-sans w-full flex items-center justify-center bg-background text-foreground overflow-hidden p-4 sm:p-6">
			{/* 背景氛围：深邃的星光感 */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden">
				{/* 左上角 - 主色光晕 (移动端缩小尺寸) */}
				<div className="absolute top-0 left-0 w-[280px] h-[280px] sm:w-[500px] sm:h-[500px] bg-primary-200/30 dark:bg-primary-900/20 rounded-full blur-[80px] sm:blur-[120px] -translate-x-1/3 -translate-y-1/3 mix-blend-multiply dark:mix-blend-screen transition-all duration-1000" />
				{/* 右下角 - 强调色光晕 (移动端缩小尺寸) */}
				<div className="absolute bottom-0 right-0 w-[280px] h-[280px] sm:w-[500px] sm:h-[500px] bg-accent-200/20 dark:bg-accent-900/20 rounded-full blur-[80px] sm:blur-[120px] translate-x-1/4 translate-y-1/4 mix-blend-multiply dark:mix-blend-screen transition-all duration-1000" />
			</div>

			<main
				className={`glass-card relative w-full max-w-[340px] sm:max-w-[520px] transition-all duration-700 ease-out border border-white/20 dark:border-white/5 shadow-glass flex flex-col ${
					mounted
						? "opacity-100 scale-100 translate-y-0"
						: "opacity-0 scale-95 translate-y-8"
				}`}
			>
				{/* 顶部装饰线 */}
				<div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-accent-400/50 to-transparent" />

				{/* 内容区域：移动端减少 padding */}
				<div className="flex flex-col items-center text-center px-5 py-8 sm:px-8 sm:py-10 grow justify-center">
					{/* 404 数字：移动端显著缩小，避免挤占空间 */}
					<div className="relative mb-6 sm:mb-8 select-none">
						<h1 className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-tighter leading-none text-primary-200/50 dark:text-primary-800/50 blur-[1px] transition-all duration-500">
							404
						</h1>
						<div className="absolute inset-0 flex items-center justify-center">
							<span className="text-sm sm:text-xl font-mono text-accent-600/80 dark:text-accent-400 tracking-[0.3em] sm:tracking-[0.5em] uppercase translate-y-1">
								Not Found
							</span>
						</div>
					</div>

					{/* 核心文案区域 */}
					<div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 w-full relative z-10">
						<div>
							<h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1.5 tracking-tight">
								迷失在星海
							</h2>
							<p className="text-[10px] sm:text-xs font-medium tracking-[0.2em] sm:tracking-[0.3em] text-accent-600/70 dark:text-accent-400/70 uppercase font-mono">
								Lost in Starlight
							</p>
						</div>

						{/* 装饰分割点 */}
						<div className="flex justify-center gap-2 py-1 opacity-50">
							<span className="w-1 h-1 rounded-full bg-primary-400" />
							<span className="w-1 h-1 rounded-full bg-primary-400" />
							<span className="w-1 h-1 rounded-full bg-primary-400" />
						</div>

						{/* 文案：移动端限制宽度以增加可读性 */}
						<p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-[260px] sm:max-w-none mx-auto">
							你所寻找的页面似乎飘向了宇宙深处，
							<br className="hidden sm:block" />
							或许它从未存在过。
						</p>
					</div>

					{/* 按钮组：移动端全宽 + 垂直排列，桌面端并排 */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
						<Link
							href="/"
							className="group relative flex items-center justify-center gap-2 h-11 sm:h-12 px-6 sm:px-8 w-full sm:w-auto rounded-lg bg-accent-600 text-white font-medium transition-all duration-300
              hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-500/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
              cursor-pointer select-none text-sm sm:text-base"
						>
							<div className="absolute inset-0 rounded-lg overflow-hidden">
								<div className="absolute top-0 left-0 w-full h-full bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
							</div>
							<svg
								className="w-4 h-4 transition-transform group-hover:-translate-x-1"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
							</svg>
							<span>返回首页</span>
						</Link>

						<button
							onClick={() => window.history.back()}
							type="button"
							className="group flex items-center justify-center gap-2 h-11 sm:h-12 px-6 sm:px-8 w-full sm:w-auto rounded-lg border border-border bg-transparent text-foreground font-medium transition-all duration-300
              hover:bg-secondary hover:border-primary-300 hover:text-accent-700 dark:hover:text-accent-400 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
              cursor-pointer select-none text-sm sm:text-base"
						>
							<svg
								className="w-4 h-4 transition-transform group-hover:-translate-x-1"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
							<span>返回上页</span>
						</button>
					</div>
				</div>

				{/* 底部状态栏 */}
				<div className="h-9 sm:h-10 border-t border-border/50 bg-primary-50/50 dark:bg-primary-950/30 flex items-center justify-between px-4 sm:px-6 text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0 rounded-b-lg">
					<div className="flex items-center gap-2">
						<span className="relative flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
							<span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
						</span>
						<span>Signal Lost</span>
					</div>
					<div>ERR: 404</div>
				</div>
			</main>
		</div>
	);
}
