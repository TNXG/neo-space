"use client";

import type { Link, LinkHealthStatus } from "@/types/api";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getArchIcon, getHostingDisplayName, getHostingIcon } from "@/lib/icon";
import { cn } from "@/lib/utils";

/**
 * 从 URL 提取主机名；非法 URL 原样返回，避免整页因单条脏数据崩溃。
 * @param url 站点地址
 * @returns 主机名
 */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 友链头像：加载失败时退化为首字母，不留破图。
 * @param props 头像地址、名称与尺寸类名
 * @returns 头像
 */
export function FriendAvatar({ link, className }: { link: Pick<Link, "avatar" | "name">; className?: string }) {
  const [failed, setFailed] = useState(!link.avatar);
  if (failed) {
    return (
      <span aria-hidden="true" className={cn("flex shrink-0 select-none items-center justify-center rounded-md bg-secondary font-medium text-secondary-foreground", className)}>
        {link.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  // 友链头像来自任意外部域名，无法预先配置 next/image 白名单
  return (
    <img src={link.avatar} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn("shrink-0 rounded-md bg-secondary object-cover", className)} />
  );
}

type PingTone = "fast" | "ok" | "slow" | "down" | "unknown";

function pingTone(health?: LinkHealthStatus): PingTone {
  if (!health) return "unknown";
  if (!health.is_alive) return "down";
  const latency = health.latency_ms ?? 0;
  if (latency < 300) return "fast";
  if (latency < 800) return "ok";
  return "slow";
}

const TONE_DOT: Record<PingTone, string> = {
  fast: "bg-emerald-500",
  ok: "bg-amber-500",
  slow: "bg-orange-500",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/40",
};

/**
 * Ping 指示：色点 + 延迟，悬停给出状态码、托管商和检查时间。
 * @param props 健康状态
 * @returns Ping 标签
 */
export function FriendPing({ health, className }: { health?: LinkHealthStatus; className?: string }) {
  const t = useTranslations("friends.ping");
  const tone = pingTone(health);
  const label = !health
    ? t("unchecked")
    : !health.is_alive
      ? t("down")
      : `${health.latency_ms ?? "–"}ms`;
  const provider = health?.hosting_provider && health.hosting_provider !== "unknown" ? health.hosting_provider : null;
  const ProviderIcon = provider ? getHostingIcon(provider) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("inline-flex cursor-default items-center gap-1.5 rounded-full font-mono text-[0.6875rem] tabular-nums text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
          {label}
          {ProviderIcon && <ProviderIcon size={11} className="opacity-60" aria-hidden="true" />}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col gap-0.5 text-xs">
        <span>{health ? (health.is_alive ? t("alive", { code: health.status_code ?? 200 }) : (health.error_message ?? t("down"))) : t("uncheckedHint")}</span>
        {provider && <span className="opacity-80">{t("hosting", { name: getHostingDisplayName(provider) })}</span>}
        {health?.checked_at && <span className="opacity-60">{t("checkedAt", { time: new Date(health.checked_at).toLocaleString() })}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 技术栈：图标 + `#tag` 文本，不加边框底色，避免和正文争夺注意力。
 * @param props 技术栈与数量上限（不传则全部展示）
 * @returns 技术栈标签
 */
export function FriendTechStack({ techstack, limit, className }: { techstack?: string[]; limit?: number; className?: string }) {
  if (!techstack?.length) return null;
  const shown = limit ? techstack.slice(0, limit) : techstack;
  const rest = techstack.length - shown.length;
  return (
    <ul aria-label="Tech stack" className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground", className)}>
      {shown.map((tech) => {
        const TechIcon = getArchIcon(tech);
        return (
          <li key={tech} className="inline-flex items-center whitespace-nowrap">
            <span aria-hidden="true" className="text-accent-600/70">#</span>
            {TechIcon && <TechIcon size={12} className="mx-0.5 shrink-0 opacity-70" aria-hidden="true" />}
            <span>{tech}</span>
          </li>
        );
      })}
      {rest > 0 && <li title={techstack.slice(shown.length).join(", ")} className="text-muted-foreground/60 tabular-nums">+{rest}</li>}
    </ul>
  );
}
