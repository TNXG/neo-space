"use client";

import type { CargoDepInfo, CargoInfo } from "./types";
import * as d3 from "d3";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { API_BASE_URL } from "@/lib/api-client";
import {
  CargoLink,
  CargoLoadingSkeleton,
  InvalidBlock,
  Metric,
  SpecialBlockHeader,
} from "./components";
import {
  CRATE_PALETTE,
  KIND_COLORS,
  TREEMAP_LABEL_FONT,
  TREEMAP_LABEL_LINE_HEIGHT,
  TREEMAP_META_FONT,
  TREEMAP_META_LINE_HEIGHT,
} from "./constants";
import {
  clampNumber,
  formatBytes,
  getKindColor,
  layoutTreemapText,
  parseCargoSpec,
} from "./utils";

interface CargoTooltipState {
  x: number;
  y: number;
  dep: CargoDepInfo;
}

export function CargoBlock({ raw }: { raw: string }) {
  const [view, setView] = useState<"treemap" | "table">("treemap");
  const [data, setData] = useState<CargoInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const spec = useMemo(() => parseCargoSpec(raw), [raw]);

  useEffect(() => {
    if (!spec) {
      return;
    }

    const controller = new AbortController();
    const url = spec.version
      ? `${API_BASE_URL}/crates/${spec.crate}/${spec.version}`
      : `${API_BASE_URL}/crates/${spec.crate}`;

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message || "cargo 数据加载失败");
        }
        return payload?.data as CargoInfo;
      })
      .then((result) => {
        setData(result);
        setFetchError(null);
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return;
        }
        setData(null);
        setFetchError(error.message);
      });

    return () => controller.abort();
  }, [spec]);

  if (!spec) {
    return <InvalidBlock title="cargo 数据块格式无效" raw={raw} />;
  }

  if (fetchError) {
    return <InvalidBlock title={fetchError} raw={raw} />;
  }

  if (!data) {
    return (
      <section className="my-5 md:my-6 overflow-hidden rounded-2xl border border-border/70 bg-white/70 shadow-sm backdrop-blur-sm dark:bg-primary-100/60">
        <SpecialBlockHeader
          title={`cargo · ${spec.crate}`}
          subtitle="Cargo 依赖体积分析"
          view={view}
          onViewChange={setView}
          views={[
            { key: "treemap", label: "Treemap" },
            { key: "table", label: "Table" },
          ]}
        />
        <CargoLoadingSkeleton />
      </section>
    );
  }

  const directCount = data.deps.filter(dep => dep.depth === 0).length;
  const featureCount = Object.keys(data.features).length;

  return (
    <section className="my-5 md:my-6 overflow-hidden rounded-2xl border border-border/70 bg-white/70 shadow-sm backdrop-blur-sm dark:bg-primary-100/60">
      <SpecialBlockHeader
        title={`cargo · ${data.name}`}
        subtitle={`Cargo 依赖体积分析${data.version ? ` · ${data.version}` : ""}`}
        view={view}
        onViewChange={setView}
        views={[
          { key: "treemap", label: "Treemap" },
          { key: "table", label: "Table" },
        ]}
      />

      <div className="px-4 py-4 md:px-5">
        {view === "treemap"
          ? (
              <CargoTreemap data={data.deps} />
            )
          : (
              <CargoTable data={data.deps} />
            )}
      </div>

      <div className="flex flex-col gap-4 border-t border-border/60 bg-zinc-50/70 px-4 py-4 text-sm dark:bg-primary-200/50 md:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-primary-500 dark:text-primary-500">
          {(["normal", "optional", "dev", "build"] as const).map(kind => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: KIND_COLORS[kind] }}
              />
              <span className="capitalize">{kind}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-primary-700 dark:text-primary-700">
            {featureCount > 0 && (
              <Metric label="Features" value={String(featureCount)} />
            )}
            <Metric
              label="Deps"
              value={`${directCount} + ${Math.max(0, data.deps.length - directCount)}`}
            />
            <Metric label="Size" value={formatBytes(data.total_dep_size)} />
            {data.rust_version && (
              <Metric label="MSRV" value={data.rust_version} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <CargoLink
              href={`https://crates.io/crates/${data.name}`}
              label="crates.io"
            />
            <CargoLink
              href={`https://lib.rs/crates/${data.name}`}
              label="lib.rs"
            />
            <CargoLink href={`https://docs.rs/${data.name}`} label="docs.rs" />
          </div>
        </div>
      </div>
    </section>
  );
}

function CargoTreemap({ data }: { data: CargoDepInfo[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<CargoTooltipState | null>(null);
  const tooltipSizeRef = useRef({ width: 320, height: 180 });
  const sizedDeps = useMemo(
    () => data.filter(dep => (dep.crate_size ?? 0) > 0),
    [data],
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!svgRef.current || sizedDeps.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 720;
    const height = 420;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const root = d3
      .hierarchy({
        children: sizedDeps.map(item => ({
          ...item,
          value: item.crate_size ?? 0,
        })),
      })
      .sum((item: any) => item.value ?? 0)
      .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));

    d3
      .treemap<any>()
      .tile(d3.treemapBinary)
      .size([width, height])
      .padding(3)
      .round(true)(root as any);

    root.leaves().forEach((leaf, index) => {
      const node = leaf as d3.HierarchyRectangularNode<any>;
      const dep = node.data as CargoDepInfo & { value: number };
      const blockWidth = node.x1 - node.x0;
      const blockHeight = node.y1 - node.y0;
      const fill = CRATE_PALETTE[index % CRATE_PALETTE.length];
      const group = svg.append("g");

      group.attr("data-crate", dep.name);

      const baseOpacity = dep.depth === 0 ? 0.88 : 0.7;

      group
        .append("rect")
        .attr("x", node.x0)
        .attr("y", node.y0)
        .attr("width", blockWidth)
        .attr("height", blockHeight)
        .attr("rx", Math.min(6, Math.min(blockWidth, blockHeight) * 0.18))
        .attr("fill", fill)
        .attr("opacity", baseOpacity)
        .attr("data-base-opacity", baseOpacity)
        .style("cursor", "pointer")
        .style("transition", "opacity 0.2s ease, filter 0.2s ease");

      if (dep.optional && blockWidth > 18 && blockHeight > 18) {
        group
          .append("rect")
          .attr("x", node.x0 + 1)
          .attr("y", node.y0 + 1)
          .attr("width", Math.max(0, blockWidth - 2))
          .attr("height", Math.max(0, blockHeight - 2))
          .attr("rx", Math.min(6, Math.min(blockWidth, blockHeight) * 0.18))
          .attr("fill", "none")
          .attr("stroke", "rgba(255,255,255,0.5)")
          .attr("stroke-dasharray", "4 3");
      }

      const textStartX = node.x0 + 8;
      const textStartY = node.y0 + 16;
      const availableTextWidth = blockWidth - 16;
      const availableTextHeight = blockHeight - 14;

      if (availableTextWidth > 24 && availableTextHeight > 16) {
        const labelMaxLines = availableTextHeight >= 44 ? 2 : 1;
        const labelLines = layoutTreemapText(
          dep.name,
          availableTextWidth,
          TREEMAP_LABEL_FONT,
          TREEMAP_LABEL_LINE_HEIGHT,
          labelMaxLines,
        );

        labelLines.forEach((line, index) => {
          group
            .append("text")
            .attr("x", textStartX)
            .attr("y", textStartY + index * TREEMAP_LABEL_LINE_HEIGHT)
            .attr("fill", "#ffffff")
            .attr("font-size", "12px")
            .attr("font-weight", 600)
            .text(line);
        });

        const metaY
          = textStartY + labelLines.length * TREEMAP_LABEL_LINE_HEIGHT + 3;
        const canRenderMeta
          = availableTextHeight
            >= labelLines.length * TREEMAP_LABEL_LINE_HEIGHT
            + TREEMAP_META_LINE_HEIGHT
            + 8;

        if (canRenderMeta) {
          const metaText = `${formatBytes(dep.crate_size ?? 0)} · ${dep.depth === 0 ? "direct" : `d${dep.depth}`}`;
          const metaLine = layoutTreemapText(
            metaText,
            availableTextWidth,
            TREEMAP_META_FONT,
            TREEMAP_META_LINE_HEIGHT,
            1,
          )[0];
          if (metaLine) {
            group
              .append("text")
              .attr("x", textStartX)
              .attr("y", metaY)
              .attr("fill", "rgba(255,255,255,0.82)")
              .attr("font-size", "10px")
              .text(metaLine);
          }
        }
      }

      group
        .on("mouseenter", function (event: MouseEvent) {
          if (!isMobile) {
            const rect = d3.select(this).select<SVGRectElement>("rect");
            rect
              .attr("opacity", 1)
              .style("filter", "brightness(1.15)");
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (containerRect) {
              setTooltip({
                x: event.clientX - containerRect.left,
                y: event.clientY - containerRect.top,
                dep,
              });
            }
          }
        })
        .on("mousemove", (event: MouseEvent) => {
          if (!isMobile) {
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (containerRect) {
              setTooltip({
                x: event.clientX - containerRect.left,
                y: event.clientY - containerRect.top,
                dep,
              });
            }
          }
        })
        .on("mouseleave", function () {
          if (!isMobile) {
            const rect = d3.select(this).select("rect");
            rect
              .attr("opacity", rect.attr("data-base-opacity") || 0.88)
              .style("filter", "none");
            setTooltip(null);
          }
        });
    });
    svg.on("mouseleave", () => setTooltip(null));
  }, [sizedDeps, isMobile]);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return;
    }

    tooltipSizeRef.current = {
      width: tooltipRef.current.offsetWidth,
      height: tooltipRef.current.offsetHeight,
    };
  }, [tooltip]);

  if (sizedDeps.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-primary-600 dark:text-primary-600">
        没有可用的依赖体积数据。
      </div>
    );
  }

  const tooltipPosition = tooltip
    ? getTooltipPosition(
        tooltip.x,
        tooltip.y,
        tooltipSizeRef.current,
        containerRef.current?.getBoundingClientRect(),
      )
    : null;

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg ref={svgRef} width="100%" className="min-h-65" />
      {!isMobile && tooltipPosition && tooltip && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 min-w-56 max-w-[min(24rem,calc(100%-1rem))] rounded-xl border border-border/60 bg-popover/95 p-3 text-xs text-popover-foreground shadow-glass backdrop-blur-xl"
          style={{
            left: tooltipPosition.left,
            top: tooltipPosition.top,
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-semibold text-primary-900 dark:text-primary-900">
              {tooltip.dep.name}
            </span>
            <span className="text-primary-600 dark:text-primary-600">
              {tooltip.dep.version}
            </span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-primary-700 dark:text-primary-700">
            <span>Kind</span>
            <span>{tooltip.dep.optional ? `${tooltip.dep.kind} (optional)` : tooltip.dep.kind}</span>
            <span>Size</span>
            <span>
              {tooltip.dep.crate_size != null ? formatBytes(tooltip.dep.crate_size) : "unknown"}
            </span>
            <span>Depth</span>
            <span>{tooltip.dep.depth === 0 ? "direct" : `transitive (${tooltip.dep.depth})`}</span>
            {tooltip.dep.target && (
              <>
                <span>Target</span>
                <span>{tooltip.dep.target}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getTooltipPosition(
  x: number,
  y: number,
  tooltipSize: { width: number; height: number },
  containerRect?: DOMRect,
): { left: number; top: number } {
  const gap = 12;
  const padding = 8;
  const containerWidth = containerRect?.width ?? 720;
  const containerHeight = containerRect?.height ?? 420;
  const preferredLeft = x + gap;
  const preferredTop = y + gap;
  const fallbackLeft = x - tooltipSize.width - gap;
  const fallbackTop = y - tooltipSize.height - gap;
  return {
    left: clampNumber(
      preferredLeft + tooltipSize.width > containerWidth - padding ? fallbackLeft : preferredLeft,
      padding,
      Math.max(padding, containerWidth - tooltipSize.width - padding),
    ),
    top: clampNumber(
      preferredTop + tooltipSize.height > containerHeight - padding ? fallbackTop : preferredTop,
      padding,
      Math.max(padding, containerHeight - tooltipSize.height - padding),
    ),
  };
}

function CargoTable({ data }: { data: CargoDepInfo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-primary-500 dark:text-primary-500">
          <tr>
            <th className="pb-3 font-medium">Crate</th>
            <th className="pb-3 font-medium">Version</th>
            <th className="pb-3 font-medium">Kind</th>
            <th className="pb-3 font-medium">Depth</th>
            <th className="pb-3 font-medium">Size</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {data.map((dep, index) => (
            <tr
              key={`${dep.name}-${dep.kind}-${dep.depth}`}
              className="transition-colors duration-200 hover:bg-accent-50/50 dark:hover:bg-accent-950/20"
            >
              <td className="py-3 pr-4">
                <span className="inline-flex items-center gap-2 font-medium text-primary-900 dark:text-primary-900">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        CRATE_PALETTE[index % CRATE_PALETTE.length],
                    }}
                  />
                  {dep.name}
                  {dep.optional && (
                    <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium text-accent-700">
                      opt
                    </span>
                  )}
                </span>
              </td>
              <td className="py-3 pr-4 text-primary-700 dark:text-primary-700">
                {dep.version}
              </td>
              <td className="py-3 pr-4 text-primary-700 dark:text-primary-700">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: getKindColor(dep) }}
                  />
                  {dep.kind}
                </span>
              </td>
              <td className="py-3 pr-4 text-primary-700 dark:text-primary-700">
                {dep.depth === 0 ? "direct" : dep.depth}
              </td>
              <td className="py-3 text-primary-700 dark:text-primary-700">
                {dep.crate_size != null ? formatBytes(dep.crate_size) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
