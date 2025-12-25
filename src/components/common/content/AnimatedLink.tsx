"use client";

import { Icon } from "@iconify/react";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import styles from "./AnimatedLink.module.scss";

// 平台图标配置
const platformIcons: Record<string, string> = {
	"github.com": "mingcute:github-line",
	"twitter.com": "mingcute:twitter-line",
	"x.com": "mingcute:twitter-line",
	"bilibili.com": "mingcute:bilibili-line",
	"t.me": "mingcute:telegram-line",
};

/**
 * 获取平台图标
 */
function getPlatformIcon(href: string): string | null {
	try {
		const { hostname } = new URL(href);
		for (const [domain, icon] of Object.entries(platformIcons)) {
			if (hostname.includes(domain))
				return icon;
		}
	} catch {}
	return null;
}

interface AnimatedLinkProps {
	href: string;
	children?: React.ReactNode;
	title?: string;
	icon?: React.ReactNode;
	className?: string;
	target?: string;
	rel?: string;
	showTooltip?: boolean;
	tooltipContentClassName?: string;
}

export function AnimatedLink({
	href,
	children,
	title,
	icon: customIcon,
	className = "",
	target = "_blank",
	rel = "noreferrer",
	showTooltip = true,
	tooltipContentClassName = "",
}: AnimatedLinkProps) {
	const iconName = useMemo(() => getPlatformIcon(href), [href]);

	const link = (
		<a
			className={`${styles.linkWrapper} ${className}`}
			href={href}
			target={target}
			title={title}
			rel={rel}
		>
			{(customIcon || iconName) && (
				<span className={styles.icon}>
					{customIcon || <Icon icon={iconName!} />}
				</span>
			)}
			<span className={styles.link}>{children || href}</span>
		</a>
	);

	if (!showTooltip)
		return link;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{link}</TooltipTrigger>
				<TooltipContent
					className={cn("p-1.5! text-xs", tooltipContentClassName)}
					side="bottom"
					sideOffset={2}
					hideArrow
				>
					<span className="block max-w-md truncate">{href}</span>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export default AnimatedLink;
