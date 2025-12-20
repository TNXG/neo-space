import type { User } from "@/types/api";
import { AbbreviationText } from "@/components/common/nbnhhsh";
import { SocialLink } from "@/components/ui/SocialLink";

interface ProfileHeaderProps {
	profile: User;
}

/**
 * Homepage profile header section
 * Displays user avatar, name, bio, intro, and social links
 */
export function ProfileHeader({ profile }: ProfileHeaderProps) {
	return (
		<header className="animate-fade-in space-y-5 md:space-y-6">
			<div className="flex gap-4 md:gap-5 items-center">
				<div className="group rounded-2xl bg-stone-200 h-16 w-16 md:h-20 md:w-20 shadow-sm relative overflow-hidden dark:bg-stone-700">
					{profile.avatar
						? (
								<img
									src={profile.avatar}
									alt={profile.name}
									className="h-full w-full object-cover"
									onError={(e) => {
										// Fallback to initial if image fails to load
										const target = e.target as HTMLImageElement;
										target.style.display = "none";
										const fallback = target.nextElementSibling as HTMLElement;
										if (fallback) {
											fallback.classList.remove("hidden");
										}
									}}
								/>
							)
						: null}
					{/* Fallback avatar */}
					<div className={`text-xl md:text-2xl font-bold h-full w-full items-center justify-center from-stone-200 to-stone-300 bg-linear-to-br text-neutral-400 ${profile.avatar ? "hidden" : "flex"}`}>
						{profile.name.charAt(0).toUpperCase()}
					</div>
					{/* Status indicator */}
					<div className="rounded-full flex h-3.5 w-3.5 md:h-4 md:w-4 items-center bottom-0.5 right-0.5 md:bottom-1 md:right-1 justify-center absolute bg-neutral-50">
						<div className="rounded-full bg-teal-500 h-2 w-2 md:h-2.5 md:w-2.5 animate-pulse" />
					</div>
				</div>
				<div>
					<h1 className="text-2xl md:text-3xl tracking-tight font-bold mb-1.5 md:mb-2 text-foreground">
						{profile.name}
					</h1>
					<p className="text-xs md:text-sm flex gap-2 items-center text-muted-foreground">
						@
						{profile.username}
					</p>
				</div>
			</div>

			<p className="text-base md:text-xl leading-relaxed max-w-lg text-secondary-foreground">
				<AbbreviationText>{profile.introduce}</AbbreviationText>
			</p>

			<div className="pt-1 md:pt-2 flex gap-4 md:gap-5 flex-wrap">
				{profile.socialIds?.github && (
					<SocialLink
						icon="mingcute:github-line"
						href={`https://github.com/${profile.socialIds.github}`}
						label="GitHub"
					/>
				)}
				{profile.socialIds?.twitter && (
					<SocialLink
						icon="mingcute:twitter-line"
						href={`https://twitter.com/${profile.socialIds.twitter}`}
						label="Twitter"
					/>
				)}
				{profile.mail && (
					<SocialLink
						icon="mingcute:mail-line"
						href={`mailto:${profile.mail}`}
						label="Email"
					/>
				)}
				{profile.socialIds?.bilibili && (
					<SocialLink
						icon="mingcute:tv-2-line"
						href={`https://space.bilibili.com/${profile.socialIds.bilibili}`}
						label="Bilibili"
					/>
				)}
				{profile.socialIds?.netease && (
					<SocialLink
						icon="mingcute:music-line"
						href={`https://music.163.com/#/user/home?id=${profile.socialIds.netease}`}
						label="NetEase Music"
					/>
				)}
				{profile.socialIds?.telegram && (
					<SocialLink
						icon="mingcute:telegram-line"
						href={`https://t.me/${profile.socialIds.telegram}`}
						label="Telegram"
					/>
				)}
				{profile.url && (
					<SocialLink
						icon="mingcute:world-line"
						href={profile.url}
						label="Website"
					/>
				)}
				{profile.socialIds?.rss && (
					<SocialLink
						icon="mingcute:rss-line"
						href={profile.socialIds.rss}
						label="RSS"
					/>
				)}
			</div>
		</header>
	);
}
