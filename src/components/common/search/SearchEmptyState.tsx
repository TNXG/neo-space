"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/lib/inline-icon";

interface SearchEmptyStateProps {
  hasQuery: boolean;
  query: string;
}

export function SearchEmptyState({ hasQuery, query }: SearchEmptyStateProps) {
  const t = useTranslations();

  if (!hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Icon icon="mingcute:search-2-line" className="text-3xl mb-2 opacity-30" />
        <p className="text-sm">{t("search.empty.start")}</p>
        <p className="text-xs mt-1 opacity-60">{t("search.empty.support")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon icon="mingcute:file-unknown-line" className="text-3xl mb-2 opacity-30" />
      <p className="text-sm">
        {t("search.empty.prefix")}
        {" "}
        <span className="text-foreground font-medium">
          &quot;
          {query}
          &quot;
        </span>
        {" "}
        {t("search.empty.suffix")}
      </p>
    </div>
  );
}
