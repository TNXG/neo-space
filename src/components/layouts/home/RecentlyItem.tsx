import type { RecentlyWithRendered } from "@/types/api";
import { SmartDate } from "@/components/common/smart-date";

interface RecentlyItemProps {
	item: RecentlyWithRendered;
}

/**
 * Recently item card component
 * Displays recent thoughts/activities in a glassmorphic card
 */
export function RecentlyItem({ item }: RecentlyItemProps) {
	return (
		<div className="mb-4 p-5 border border-neutral-200 bg-surface-50 rounded-lg transition-colors duration-200 hover:border-neutral-300">
			<div className="text-primary-900 dark:text-primary-100 text-[17px] leading-relaxed mb-3 break-anywhere wrap-break-word">
				{item.renderedContent}
			</div>
			<div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
				{item.created && (
					<SmartDate
						date={item.created}
						className="text-xs text-neutral-500 font-mono"
					/>
				)}
			</div>
		</div>
	);
}
