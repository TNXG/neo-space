"use client";

import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FootnoteReferenceProps {
  id: string;
  footnoteId: string;
  href: string | undefined;
  ariaLabel: string;
  children: React.ReactNode;
}

export function FootnoteReference({ id, footnoteId, href, ariaLabel, children }: FootnoteReferenceProps) {
  const [html, setHtml] = useState("");
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      const item = document.querySelector(`[data-footnote-item][data-footnote-id="${footnoteId}"]`);
      if (item) {
        const clone = item.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("[data-footnote-backref]").forEach(n => n.remove());
        clone.querySelectorAll(".footnote-backref-icon").forEach(n => n.remove());
        clone.querySelectorAll("script").forEach(n => n.remove());
        setHtml(clone.innerHTML.replace(/\s+/g, " ").trim());
      }
    }
    setOpen(newOpen);
  };

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <a
            data-footnote-ref="true"
            data-footnote-id={footnoteId}
            id={id}
            href={href || "#"}
            aria-label={ariaLabel}
          >
            {children}
          </a>
        </TooltipTrigger>
        {html && (
          <TooltipContent
            hideArrow={false}
            side="top"
            sideOffset={8}
            className="max-w-sm rounded-md bg-primary-900/95 dark:bg-primary-100/95 px-3 py-2.5 text-sm leading-6 text-primary-100 dark:text-primary-900 shadow-lg [&_a]:text-accent-400 dark:[&_a]:text-accent-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-300 dark:hover:[&_a]:text-accent-700 [&_code]:rounded [&_code]:bg-primary-700/70 dark:[&_code]:bg-primary-300/70 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-primary-50 dark:[&_code]:text-primary-950 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_p]:text-primary-100! dark:[&_p]:text-primary-900! [&_p]:text-sm! [&_li]:text-primary-100! dark:[&_li]:text-primary-900! [&_li]:text-sm! [&_span]:text-primary-100! dark:[&_span]:text-primary-900! **:data-footnote-backref:hidden"
          >
            {/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml */}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
