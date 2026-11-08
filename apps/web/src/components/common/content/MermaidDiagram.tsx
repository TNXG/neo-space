"use client";

import type { Mermaid } from "mermaid";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ZoomableContainer } from "./ZoomableContainer";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let mermaidReady: Promise<Mermaid> | undefined;

/** Initialize the shared Mermaid runtime once, without resetting configuration during another render. */
const loadMermaid = () => {
  mermaidReady ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      // The component owns the error UI; Mermaid must not leave an error SVG in the document.
      suppressErrorRendering: true,
      fontFamily: "var(--font-noto-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
    });
    return mermaid;
  });
  return mermaidReady;
};

/** Render each source in an owned staging node and discard results from superseded locale/content renders. */
export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const t = useTranslations();
  const stagingRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{ chart: string; svg?: string; error?: string }>();
  const current = result?.chart === chart ? result : undefined;

  useEffect(() => {
    const staging = document.createElement("div");
    stagingRef.current?.append(staging);
    let active = true;

    /** Render into a private, measurable DOM subtree, never Mermaid's default document.body host. */
    const renderDiagram = async () => {
      try {
        const mermaid = await loadMermaid();
        if (!active)
          return;
        const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, chart, staging);
        if (active)
          setResult({ chart, svg });
      } catch (error) {
        if (active)
          setResult({ chart, error: error instanceof Error ? error.message : String(error) });
      } finally {
        staging.remove();
      }
    };

    void renderDiagram();
    return () => {
      active = false;
      staging.remove();
    };
  }, [chart]);

  return (
    <>
      <div ref={stagingRef} aria-hidden="true" className="pointer-events-none invisible fixed -left-[10000px] top-0" />
      {current?.error
        ? (
            <div role="status" className={`my-6 min-w-0 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-foreground ${className}`}>
              <p className="mb-2 text-sm font-medium">{t("common.mermaid.renderError")}</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{current.error}</pre>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer">{t("common.mermaid.source")}</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{chart}</pre>
              </details>
            </div>
          )
        : (
            <ZoomableContainer
              className={`my-8 ${className}`}
              viewportClassName="flex justify-center items-center p-6 rounded-2xl bg-surface-100/50 backdrop-blur-sm border border-primary-200 shadow-sm"
            >
              <div
                className="flex justify-center items-center"
                aria-busy={!current?.svg}
                // Mermaid produces the SVG from the authored diagram source.
                // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
                dangerouslySetInnerHTML={{ __html: current?.svg ?? "" }}
              />
            </ZoomableContainer>
          )}
    </>
  );
}
