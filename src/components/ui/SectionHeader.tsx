import { Icon } from "@iconify/react/offline";
import type {IconifyIcon} from "@iconify/react/offline" 

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
    <div className="mb-6 pb-2 border-b border-neutral-300 flex items-baseline justify-between">
      <h2 className="text-xl font-semibold flex gap-2 items-center text-primary-800">
        <Icon icon={icon} className="text-[18px] text-neutral-500" />
        {title}
      </h2>
      {linkText && linkHref && (
        <a
          href={linkHref}
          className="group text-sm flex gap-1 transition-colors duration-150 items-center text-neutral-700"
        >
          {linkText}
          <Icon
            icon={icon}
            className="text-[14px] opacity-0 transition-opacity duration-150 -ml-1 group-hover:ml-0 group-hover:opacity-100"
          />
        </a>
      )}
    </div>
  );
}
