"use client";

import type { GuestUser } from "./types";

interface GuestInputsProps {
	user: GuestUser;
	onChange: (user: GuestUser) => void;
}

/**
 * 游客信息输入组件
 */
export function GuestInputs({ user, onChange }: GuestInputsProps) {
	return (
		<div className="flex items-center gap-2 w-full sm:w-auto">
			<input
				value={user.name}
				onChange={e => onChange({ ...user, name: e.target.value })}
				placeholder="昵称*"
				className="flex-1 sm:flex-initial sm:w-24 bg-transparent border-b border-border/50 focus:border-accent-500 rounded-none px-1 py-1 text-[11px] sm:text-xs outline-none transition-all placeholder:text-muted-foreground/50 text-center"
			/>
			<input
				value={user.email}
				onChange={e => onChange({ ...user, email: e.target.value })}
				placeholder="邮箱"
				className="flex-1 sm:flex-initial sm:w-32 bg-transparent border-b border-border/50 focus:border-accent-500 rounded-none px-1 py-1 text-[11px] sm:text-xs outline-none transition-all placeholder:text-muted-foreground/50 text-center"
			/>
		</div>
	);
}
