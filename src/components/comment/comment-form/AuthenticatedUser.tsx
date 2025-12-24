"use client";

import { motion } from "motion/react";
import { ProfilePopover } from "@/components/comment/auth/ProfilePopover";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./SubmitButton";

interface AuthUser {
	name: string;
	email: string;
	image: string;
}

interface AuthenticatedUserProps {
	user: AuthUser;
	isProfileOpen: boolean;
	onProfileOpenChange: (open: boolean) => void;
	onAvatarChange?: () => void;
	onSubmit: () => void;
	canSubmit: boolean;
	isPending: boolean;
}

/**
 * 已登录用户信息和操作区
 */
export function AuthenticatedUser({
	user,
	isProfileOpen,
	onProfileOpenChange,
	onAvatarChange,
	onSubmit,
	canSubmit,
	isPending,
}: AuthenticatedUserProps) {
	return (
		<motion.div
			key="logged-in"
			initial={{ opacity: 0, x: 10 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -10 }}
			className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3"
		>
			<ProfilePopover
				isOpen={isProfileOpen}
				onOpenChange={onProfileOpenChange}
				onAvatarChange={onAvatarChange}
			>
				<button
					type="button"
					className={cn(
						"flex items-center gap-1.5 sm:gap-2 pl-0.5 sm:pl-1 pr-2 sm:pr-3 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer",
						isProfileOpen
							? "bg-accent-50 border-accent-200 ring-1 ring-accent-100"
							: "bg-transparent border-transparent hover:bg-primary-50 hover:border-primary-200",
					)}
				>
					<img src={user.image} alt={user.name} className="size-5 sm:size-6 rounded-full" />
					<span className="text-[11px] sm:text-xs font-medium text-foreground max-w-[60px] sm:max-w-[80px] truncate">
						{user.name}
					</span>
				</button>
			</ProfilePopover>
			<SubmitButton onClick={onSubmit} disabled={!canSubmit} isPending={isPending} />
		</motion.div>
	);
}
