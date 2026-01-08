"use client";

import type { ReactNode } from "react";
import { createContext, use, useState } from "react";

interface PageInfo {
  pageType: "post" | "note" | "page";
  pageId: string;
  pageTitle?: string;
}

interface PageContextValue {
  pageInfo: PageInfo | null;
  setPageInfo: (info: PageInfo | null) => void;
}

const PageContext = createContext<PageContextValue | undefined>(undefined);

export function PageProvider({ children }: { children: ReactNode }) {
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);

  return (
    <PageContext value={{ pageInfo, setPageInfo }}>
      {children}
    </PageContext>
  );
}

export function usePageContext() {
  const context = use(PageContext);
  if (context === undefined) {
    throw new Error("usePageContext must be used within a PageProvider");
  }
  return context;
}
