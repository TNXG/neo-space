import type { ReactNode } from "react";

interface SectionHeaderProps {
	title: string;
	jpTitle?: string;
	action?: ReactNode | string;
}

export function SectionHeader({ title, jpTitle, action }: SectionHeaderProps) {
	return (
		<div className="mb-5 px-1 flex items-center justify-between">
			<div className="flex gap-3 items-baseline">
				<h2 className="text---text-main text-(lg) tracking-tight font-bold">{title}</h2>
				{jpTitle && (
					<span className="text---text-sub text-([10px]) tracking-widest font-medium font-mono opacity-60 uppercase translate-y-px transform">
						{jpTitle}
					</span>
				)}
			</div>
			{action && <div className="text---accent text-(xs) cursor-pointer hover:underline">{action}</div>}
		</div>
	);
}
