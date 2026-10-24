"use client";

import type { DashboardOwnerProfile } from "@/types/api";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

interface OwnerIdentityProps {
  profile: DashboardOwnerProfile | null;
  identifying: boolean;
  unmatched: boolean;
}

/** 在身份卡片中呈现等待、识别中、未匹配及公开资料状态。 */
export function OwnerIdentity({ profile, identifying, unmatched }: OwnerIdentityProps) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const name = identifying ? "正在确认账号…" : unmatched ? "未找到该账号" : profile?.name || profile?.username || "等待身份识别";
  const avatar = profile?.avatar || "/favicon.webp";

  return (
    <div id="dashboard-identity-status" role="status" className="flex min-h-16 min-w-0 items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2" aria-live="polite">
      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-lg font-medium text-secondary-foreground">
        <AnimatePresence initial={false}>
          <motion.div key={avatar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0 flex items-center justify-center">
            {failedAvatar !== avatar ? (
              <Image src={avatar} alt="" width={40} height={40} unoptimized className="size-full object-cover" onError={() => setFailedAvatar(avatar)} />
            ) : (
              <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="relative h-5 w-full">
          <AnimatePresence initial={false}>
            <motion.span key={name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0 truncate text-sm font-medium">{name}</motion.span>
          </AnimatePresence>
        </div>
        <span className="text-xs text-muted-foreground">{identifying ? "正在连接你的空间" : unmatched ? "检查你的登录凭据" : profile ? "已找到空间主人" : "输入用户名或邮箱以连接"}</span>
      </div>
    </div>
  );
}
