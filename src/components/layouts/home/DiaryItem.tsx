interface DiaryItemProps {
	date: string;
	title: string;
	weather: string;
	mood: string;
	content: string;
}

export function DiaryItem({ date, title, weather, mood, content }: DiaryItemProps) {
	return (
		<div className="pb-10 pl-8 border-(--border-color l) relative last:pb-0 last:border-0">
			<div className="bg---accent border-(--bg-primary 2) rounded-full h-3 w-3 top-1 absolute -left-1.5" />
			<div className="mb-2 flex gap-3 items-center">
				<span className="text---accent text-(xs) font-bold font-mono">{date}</span>
				<span className="text---text-sub bg---bg-card text-([10px]) px-2 py-0.5 border border-(--border-color) rounded">
					{weather}
					{" "}
					•
					{mood}
				</span>
			</div>
			<h4 className="text---text-main text-(sm) font-bold mb-1">{title}</h4>
			<p className="text---text-sub text-(sm) leading-relaxed">{content}</p>
		</div>
	);
}
