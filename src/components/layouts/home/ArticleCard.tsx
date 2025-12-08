import { IconClock } from "@/components/icons";
import { GlassCard, Tag } from "@/components/ui";

interface ArticleCardProps {
	title: string;
	date: string;
	category: string;
	readTime: string;
	onClick?: () => void;
}

export function ArticleCard({ title, date, category, readTime, onClick }: ArticleCardProps) {
	return (
		<GlassCard hoverEffect={true} onClick={onClick} className="group flex flex-col h-full">
			<div className="mb-3 flex items-center justify-between">
				<Tag label={category} />
				<span className="text---text-sub text-([10px]) font-mono">{date}</span>
			</div>
			<h3 className="group-hover:text---accent text-lg leading-tight font-bold mb-2 transition-colors">
				{title}
			</h3>
			<p className="text---text-sub text-(xs) leading-relaxed mb-4 line-clamp-2">
				A brief exploration into the depths of user interface design and how we can improve clarity through reduction.
			</p>
			<div className="text---text-sub text-([10px]) font-bold mt-auto flex gap-2 uppercase items-center">
				<IconClock className="h-2.5 w-2.5" />
				<span>{readTime}</span>
			</div>
		</GlassCard>
	);
}
