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

			{/* 社交链接 */}
			<div className="flex justify-center items-center gap-2 mb-8">
				{user.social_ids?.github && (
					<a
						href={`https://github.com/${user.social_ids.github}`}
						className="p-2.5 rounded-full text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="GitHub"
					>
						<Icon icon="mingcute:github-line" className="text-xl" />
					</a>
				)}
				{user.social_ids?.twitter && (
					<a
						href={`https://twitter.com/${user.social_ids.twitter}`}
						className="p-2.5 rounded-full text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Twitter"
					>
						<Icon icon="mingcute:twitter-line" className="text-xl" />
					</a>
				)}
				{user.social_ids?.mail && (
					<a
						href={`mailto:${user.social_ids.mail}`}
						className="p-2.5 rounded-full text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
						aria-label="Email"
					>
						<Icon icon="mingcute:mail-line" className="text-xl" />
					</a>
				)}
				{user.social_ids?.rss && (
					<a
						href={user.social_ids.rss}
						className="p-2.5 rounded-full text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="RSS"
					>
						<Icon icon="mingcute:rss-line" className="text-xl" />
					</a>
				)}
			</div>

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
						href="https://github.com/tnxg/neo-space"
						className="text-accent/80 hover:text-accent hover:underline underline-offset-2 cursor-pointer transition-colors"
						target="_blank"
						rel="noopener noreferrer"
					>
						neo-space
					</a>
					<span className="mx-1.5 text-neutral-300">|</span>
					Built with Next.js & Rocket.rs
				</p>
			</div>
		</footer>
	);
}
