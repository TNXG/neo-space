import type { User } from "@/types/api";
import { Icon } from "@iconify/react/offline";

interface FooterProps {
	user: User;
}

/**
 * 页脚组件
 * 显示订阅链接、版权信息和技术栈
 */
export function Footer({ user }: FooterProps) {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="pt-12 pb-8">
			{/* 分隔线 */}
			<div className="h-px bg-linear-to-r from-transparent via-neutral-300 to-transparent mb-10" />

			{/* 底部信息 */}
			<div className="text-center space-y-2">
				{/* 版权信息 */}
				<p className="text-sm text-text-secondary">
					©
					{" "}
					{currentYear}
					{" "}
					{user.name}
					<span className="mx-2 text-neutral-300">·</span>
					{user.introduce || "保持简单，保持思考。"}
				</p>

				{/* 技术栈 & 框架信息 */}
				<p className="text-xs text-text-tertiary">
					Powered by
					{" "}
					<a
						href="https://github.com/tnxg/neo-space-space"
						className="text-accent-800 hover:text-accent-500 underline underline-offset-2 cursor-pointer transition-colors"
						target="_blank"
						rel="noopener noreferrer"
					>
						Neo-Space
					</a>
					<span className="mx-1.5 text-neutral-300">|</span>
					Built with Next.js & Rocket.rs
				</p>
			</div>
		</footer>
	);
}
