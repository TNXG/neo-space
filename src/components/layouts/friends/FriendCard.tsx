import { Avatar, GlassCard } from "@/components/ui";

interface FriendCardProps {
	name: string;
	role: string;
	avatar: string;
	url: string;
}

export function FriendCard({ name, role, avatar, url }: FriendCardProps) {
	return (
		<a href={url} target="_blank" rel="noopener noreferrer" className="block">
			<GlassCard hoverEffect={true} padding="p-4" className="flex gap-3 items-center">
				<Avatar src={avatar} size="w-10 h-10" />
				<div className="flex flex-col min-w-0">
					<span className="text---text-main text-(xs) font-bold truncate">{name}</span>
					<span className="text---text-sub text-([10px]) truncate">{role}</span>
				</div>
			</GlassCard>
		</a>
	);
}
