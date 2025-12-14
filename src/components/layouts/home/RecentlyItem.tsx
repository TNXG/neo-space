import type { Recently } from "@/types/api";
import { AbbreviationText } from "@/components/common/nbnhhsh";

interface RecentlyItemProps {
	item: Recently;
}

/**
 * Recently item card component
 * Displays recent thoughts/activities in a glassmorphic card
 */
export function RecentlyItem({ item }: RecentlyItemProps) {
	const formattedDate = item.created
		? new Date(item.created).toLocaleDateString("zh-CN", {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			})
		: "";

	return (
		<div className="mb-4 p-5 border border-neutral-200 bg-surface-50 rounded-lg transition-colors duration-200 hover:border-neutral-300">
			<p className="text-neutral-700 text-[17px] leading-relaxed mb-3 break-anywhere wrap-break-word">
				<AbbreviationText>{item.content}</AbbreviationText>
			</p>
			<div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
				<div className="text-xs text-neutral-500 font-mono">
					{formattedDate}
				</div>
			</div>
		</div>
	);
}
