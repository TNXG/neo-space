import { Icon } from "@iconify/react/offline";
import type {IconifyIcon} from "@iconify/react/offline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SocialLinkProps {
  icon: string | IconifyIcon;
  href: string;
  label?: string;
}

/**
 * Social media link component with icon and tooltip
 */
export function SocialLink({ icon, href, label }: SocialLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="transition-colors duration-150 text-muted-foreground hover:text-foreground"
        >
          <Icon icon={icon} className="text-[20px]" />
        </a>
      </TooltipTrigger>
      {label && (
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
