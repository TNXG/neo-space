import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SVGProps } from "react";
import type { ComponentType } from "react";

interface SocialLinkProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
  label?: string;
}

/**
 * Social media link component with icon and tooltip
 */
export function SocialLink({ icon: Icon, href, label }: SocialLinkProps) {
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
          <Icon className="text-[20px]" />
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
