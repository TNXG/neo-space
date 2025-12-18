"use client";

import { Icon } from "@iconify/react/offline";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ArticleNavButtonsProps {
	prevLink?: string;
	nextLink?: string;
}

/**
 * 文章导航按钮组
 */
export function ArticleNavButtons({ prevLink, nextLink }: ArticleNavButtonsProps) {
	const router = useRouter();

	const handleBack = () => {
		if (window.history.length > 1) {
			router.back();
		} else {
			router.push("/");
		}
	};

	return (
		<div className="mt-8 space-y-3">
			<div className="flex gap-2">
				<button
					type="button"
					onClick={handleBack}
					className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-accent/20 hover:bg-accent/40 rounded-lg transition-all cursor-pointer"
					title="返回上一页"
				>
					<Icon icon="mingcute:arrow-left-line" className="text-sm" />
					<span>返回</span>
				</button>
				<Link
					href="/"
					className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-accent/20 hover:bg-accent/40 rounded-lg transition-all cursor-pointer"
					title="返回首页"
				>
					<Icon icon="mingcute:home-2-line" className="text-sm" />
					<span>首页</span>
				</Link>
			</div>

			{(prevLink || nextLink) && (
				<div className="flex gap-2">
					{prevLink
						? (
								<Link
									href={prevLink}
									className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-accent/20 hover:bg-accent/40 rounded-lg transition-all cursor-pointer"
									title="上一篇"
								>
									<Icon icon="mingcute:left-line" className="text-sm" />
									<span>上一篇</span>
								</Link>
							)
						: (
								<div className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground/30 bg-accent/10 rounded-lg cursor-not-allowed text-center">
									<span>上一篇</span>
								</div>
							)}
					{nextLink
						? (
								<Link
									href={nextLink}
									className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-accent/20 hover:bg-accent/40 rounded-lg transition-all cursor-pointer"
									title="下一篇"
								>
									<span>下一篇</span>
									<Icon icon="mingcute:right-line" className="text-sm" />
								</Link>
							)
						: (
								<div className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground/30 bg-accent/10 rounded-lg cursor-not-allowed text-center">
									<span>下一篇</span>
								</div>
							)}
				</div>
			)}
		</div>
	);
}
