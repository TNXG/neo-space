"use client";

import type { GuestUser } from "./types";
import { motion } from "motion/react";
import { GuestInputs } from "./GuestInputs";
import { LoginPopover } from "./LoginPopover";
import { SubmitButton } from "./SubmitButton";

interface GuestActionsProps {
	user: GuestUser;
	onUserChange: (user: GuestUser) => void;
	onSubmit: () => void;
	canSubmit: boolean;
	isPending: boolean;
}

/**
 * 游客操作区（输入框 + 登录按钮 + 发送按钮）
 */
export function GuestActions({
	user,
	onUserChange,
	onSubmit,
	canSubmit,
	isPending,
}: GuestActionsProps) {
	return (
		<motion.div
			key="guest"
			initial={{ opacity: 0, x: 10 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -10 }}
			className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 w-full sm:w-auto"
		>
			{/* 输入框 */}
			<GuestInputs user={user} onChange={onUserChange} />

			{/* 登录按钮 + 发送按钮 */}
			<div className="flex items-center justify-end gap-1.5 sm:gap-2">
				<LoginPopover />
				<SubmitButton onClick={onSubmit} disabled={!canSubmit} isPending={isPending} />
			</div>
		</motion.div>
	);
}
