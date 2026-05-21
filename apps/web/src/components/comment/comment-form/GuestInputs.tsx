"use client";

import type { GuestUser } from "./types";
import { useTranslations } from "next-intl";

interface GuestInputsProps {
  user: GuestUser;
  onChange: (user: GuestUser) => void;
}

/**
 * 游客信息输入组件
 */
export function GuestInputs({ user, onChange }: GuestInputsProps) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <input
        value={user.name}
        onChange={e => onChange({ ...user, name: e.target.value })}
        placeholder={t("comment.nicknamePlaceholder")}
        className="flex-1 sm:flex-initial sm:w-24 bg-transparent border-b border-border/50 focus:border-accent-500 rounded-none px-2 py-1.5 text-xs sm:text-xs outline-none transition-all placeholder:text-muted-foreground/50 text-center min-w-0"
      />
      <input
        value={user.email}
        onChange={e => onChange({ ...user, email: e.target.value })}
        placeholder={t("comment.emailPlaceholder")}
        className="flex-1 sm:flex-initial sm:w-32 bg-transparent border-b border-border/50 focus:border-accent-500 rounded-none px-2 py-1.5 text-xs sm:text-xs outline-none transition-all placeholder:text-muted-foreground/50 text-center min-w-0"
      />
    </div>
  );
}
