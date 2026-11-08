"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { decodeAnchor } from "@/lib/content/anchor";
import { Icon } from "@/lib/icons/inline-icon";
import { cn } from "@/lib/utils";
import { useTOCStore } from "@/stores/toc-store";
import styles from "./AnimatedLink.module.scss";

// 平台图标配置
const platformIcons: Record<string, string> = {
  "github.com": "mingcute:github-line",
  "twitter.com": "mingcute:twitter-line",
  "x.com": "mingcute:twitter-line",
  "bilibili.com": "mingcute:bilibili-line",
  "t.me": "mingcute:telegram-line",
};

/**
 * 获取平台图标
 */
function getPlatformIcon(href: string): string | null {
  try {
    const { hostname } = new URL(href);
    for (const [domain, icon] of Object.entries(platformIcons)) {
      if (hostname.includes(domain))
        return icon;
    }
  } catch {}
  return null;
}

interface AnimatedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  icon?: React.ReactNode;
  showTooltip?: boolean;
  name?: string;
  tooltipContentClassName?: string;
}

export function AnimatedLink({
  id,
  name,
  href,
  children,
  title,
  icon: customIcon,
  className = "",
  target = "_blank",
  rel = "noreferrer",
  showTooltip = true,
  tooltipContentClassName = "",
  onClick,
  ...anchorProps
}: AnimatedLinkProps) {
  const iconName = useMemo(() => getPlatformIcon(href), [href]);

  /** Handle only ordinary same-document fragment clicks; preserve new-tab and download semantics. */
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const link = event.currentTarget;
    if (link.hasAttribute("download") || (link.target && link.target !== "_self"))
      return;
    const url = new URL(link.href);
    if (!url.hash || url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search)
      return;
    if (useTOCStore.getState().scrollToCenter(decodeAnchor(url.hash)))
      event.preventDefault();
  };

  const link = (
    <a
      {...anchorProps}
      id={id}
      {...(name ? { name } : {})}
      className={`${styles.linkWrapper} ${className}`}
      href={href}
      target={target}
      title={title}
      rel={rel}
      onClick={handleClick}
    >
      {(customIcon || iconName) && (
        <span className={styles.icon}>
          {customIcon || <Icon icon={iconName!} />}
        </span>
      )}
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
