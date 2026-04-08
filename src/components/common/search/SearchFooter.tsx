"use client";

import { useTranslations } from "next-intl";
import { KbdShortcut } from "@/components/ui/kbd";
import { MeiliSearchIcon } from "@/lib/file-icons";

export function SearchFooter() {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-end sm:justify-between px-5 py-2.5 border-t border-border/30 text-xs text-muted-foreground/60">
      <div className="hidden sm:flex items-center gap-3">
        <span className="flex items-center gap-1">
          <KbdShortcut keys={["Up"]} />
          <KbdShortcut keys={["Down"]} />
          {t("search.footer.navigate")}
        </span>
        <span className="flex items-center gap-1">
          <KbdShortcut keys={["Enter"]} />
          {t("search.footer.confirm")}
        </span>
        <span className="flex items-center gap-1">
          <KbdShortcut keys={["Esc"]} />
          {t("search.footer.close")}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span>Powered by</span>
        <div className="text-neutral-600">
          <MeiliSearchIcon
            style={{ height: "14px", width: "84px" }}
            className="transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
