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
		<div className="mb-4 pb-4 border-b border-border last:border-b-0">
			<div className="text-foreground/70 text-[17px] leading-relaxed mb-3 break-anywhere wrap-break-word">
				{item.renderedContent}
			</div>
			<div className="flex items-center justify-between">
				{item.created && (
					<SmartDate
						date={item.created}
						className="text-xs text-muted-foreground font-mono"
					/>
				)}
			</div>
		</div>
	);
}
