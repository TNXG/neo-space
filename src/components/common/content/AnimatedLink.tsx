"use client";

import type { ComponentType, SVGProps } from "react";
import { useMemo } from "react";
import BilibiliLine from "~icons/mingcute/bilibili-line";
import GithubLine from "~icons/mingcute/github-line";
import TelegramLine from "~icons/mingcute/telegram-line";
import TwitterLine from "~icons/mingcute/twitter-line";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import styles from "./AnimatedLink.module.scss";

// 平台图标配置
const platformIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "github.com": GithubLine,
  "twitter.com": TwitterLine,
  "x.com": TwitterLine,
  "bilibili.com": BilibiliLine,
  "t.me": TelegramLine,
};

/**
 * 获取平台图标
 */
function getPlatformIcon(href: string): ComponentType<SVGProps<SVGSVGElement>> | null {
  try {
    const { hostname } = new URL(href);
    for (const [domain, icon] of Object.entries(platformIcons)) {
      if (hostname.includes(domain))
        return icon;
    }
  } catch {}
  return null;
}

interface AnimatedLinkProps {
  href: string;
  children?: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  showTooltip?: boolean;
  tooltipContentClassName?: string;
}

function IconRenderer({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement>> }) {
  return <Icon />;
}

export function AnimatedLink({
  href,
  children,
  title,
  icon: customIcon,
  className = "",
  target = "_blank",
  rel = "noreferrer",
  showTooltip = true,
  tooltipContentClassName = "",
}: AnimatedLinkProps) {
  const PlatformIcon = useMemo(() => getPlatformIcon(href), [href]);

  const link = (
    <a
      className={`${styles.linkWrapper} ${className}`}
      href={href}
      target={target}
      title={title}
      rel={rel}
    >
      {customIcon
        ? (
            <span className={styles.icon}>{customIcon}</span>
          )
        : PlatformIcon
          ? (
              <span className={styles.icon}>
                <IconRenderer icon={PlatformIcon} />
              </span>
            )
          : null}
      <span className={styles.link}>{children || href}</span>
    </a>
  );

  if (!showTooltip)
    return link;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent
          className={cn("p-1.5! text-xs", tooltipContentClassName)}
          side="bottom"
          sideOffset={2}
          hideArrow
        >
          <span className="block max-w-md truncate">{href}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default AnimatedLink;
