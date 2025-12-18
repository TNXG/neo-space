import { Icon } from "@iconify/react/offline";
import type {IconifyIcon} from "@iconify/react/offline" 
import Link from "next/link";

interface SectionHeaderProps {
  title: string;
  icon: string | IconifyIcon;
  linkText?: string;
  linkHref?: string;
}

/**
 * Reusable section header component with icon and optional link
 */
export function SectionHeader({ title, icon, linkText, linkHref }: SectionHeaderProps) {
  return (
    <div className="mb-6 pb-2 border-b border-border flex items-baseline justify-between">
      <h2 className="text-xl font-semibold flex gap-2 items-center text-foreground">
        <Icon icon={icon} className="text-[18px] text-muted-foreground" />
        {title}
      </h2>
      {linkText && linkHref && (
        <Link
          href={linkHref}
          className="group text-sm flex gap-1 transition-colors duration-150 items-center text-muted-foreground hover:text-foreground"
        >
          {linkText}
          <Icon
            icon={icon}
            className="text-[14px] opacity-0 transition-opacity duration-150 -ml-1 group-hover:ml-0 group-hover:opacity-100"
          />
        </Link>
      )}
    </div>
  );
}
