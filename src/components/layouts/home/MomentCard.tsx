import { GlassCard } from "@/components/ui";

interface MomentCardProps {
	content: string;
	time: string;
	tags?: string[];
}

export function MomentCard({ content, time, tags }: MomentCardProps) {
	return (
		<GlassCard padding="p-5" className="mb-4 last:mb-0">
			<div className="flex gap-3 items-start">
				<div className="rounded-full h-8 min-w-8 w-8 overflow-hidden from-gray-200 to-gray-400 bg-linear-to-br">
					<img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix" alt="avatar" />
				</div>
				<div className="flex-1">
					<div className="mb-1 flex items-center justify-between">
						<span className="text---text-main text-(sm) font-bold">Alex Chen</span>
						<span className="text---text-sub text-([10px])">{time}</span>
					</div>
					<p className="text---text-main text-(sm) leading-relaxed mb-3">{content}</p>
					{tags && (
						<div className="flex gap-2">
							{tags.map(t => (
								<span key={t} className="text---accent text-([10px]) opacity-80">
									#
									{t}
								</span>
							))}
						</div>
					)}
				</div>
			</div>
		</GlassCard>
	);
}
