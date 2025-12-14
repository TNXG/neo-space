import { Icon } from "@iconify/react/offline";
import type {IconifyIcon} from "@iconify/react/offline" 

interface SocialLinkProps {
  icon: string | IconifyIcon;
  href: string;
  label?: string;
}

/**
 * Social media link component with icon
 */
export function SocialLink({ icon, href, label }: SocialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="transition-colors duration-150 text-neutral-400"
    >
      <Icon icon={icon} className="text-[20px] hover:opacity-70" />
    </a>
  );
}
