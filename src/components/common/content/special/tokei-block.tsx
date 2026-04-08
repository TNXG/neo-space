"use client";

import type { LangStat } from "./types";
import * as d3 from "d3";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  InvalidBlock,
  Metric,
  SpecialBlockHeader,
  StackBar,
} from "./components";
import {
  TREEMAP_LABEL_FONT,
  TREEMAP_LABEL_LINE_HEIGHT,
  TREEMAP_META_FONT,
  TREEMAP_META_LINE_HEIGHT,
} from "./constants";
import {
  clampNumber,
  formatCompact,
  formatFull,
  getLanguageColor,
  layoutTreemapText,
  parseTokei,
  percentage,
} from "./utils";

interface TokeiTooltipState {
  x: number;
  y: number;
  stat: LangStat;
}

export function TokeiBlock({ raw }: { raw: string }) {
  const [view, setView] = useState<"treemap" | "table">("treemap");
  const data = useMemo(
    () => parseTokei(raw).toSorted((left, right) => right.lines - left.lines),
    [raw],
  );

  const totals = useMemo(() => {
    return data.reduce(
      (accumulator, stat) => ({
        files: accumulator.files + stat.files,
        lines: accumulator.lines + stat.lines,
        code: accumulator.code + stat.code,
        comments: accumulator.comments + stat.comments,
        blanks: accumulator.blanks + stat.blanks,
      }),
      { files: 0, lines: 0, code: 0, comments: 0, blanks: 0 },
    );
  }, [data]);

  if (data.length === 0) {
    return <InvalidBlock title="tokei 数据无法解析" raw={raw} />;
  }

  return (
    <section className="my-5 md:my-6 overflow-hidden rounded-2xl border border-border/70 bg-white/70 shadow-sm backdrop-blur-sm dark:bg-primary-100/60">
      <SpecialBlockHeader
        title="tokei"
        subtitle="代码语言统计"
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
              <TokeiTreemap data={data} />
            )
          : (
              <TokeiTable data={data} />
            )}
      </div>

      <div className="flex flex-col gap-4 border-t border-border/60 bg-zinc-50/70 px-4 py-4 text-sm dark:bg-primary-200/50 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-primary-700 dark:text-primary-700">
          <Metric label="文件数" value={formatCompact(totals.files)} />
          <Metric label="总行数" value={formatCompact(totals.lines)} />
          <Metric label="代码行" value={formatCompact(totals.code)} />
          <Metric
            label="注释率"
            value={`${percentage(totals.comments, totals.lines)}%`}
          />
        </div>

        <div className="flex items-center gap-x-3">
          <div className="hidden h-3.5 w-px bg-border/60 md:block" />
          <a
            href="https://github.com/XAMPPRocky/tokei"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 transition-colors hover:text-accent-800"
          >
            tokei
          </a>
        </div>
      </div>
    </section>
  );
}

function TokeiTreemap({ data }: { data: LangStat[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TokeiTooltipState | null>(null);
  const tooltipSizeRef = useRef({ width: 300, height: 220 });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 720;
    const height = 420;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const root = d3
      .hierarchy({
        children: data.map(item => ({ ...item, value: item.lines })),
      })
      .sum((item: any) => item.value ?? 0)
      .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));

    d3.treemap<any>().size([width, height]).padding(3).round(true)(root as any);

    root.leaves().forEach((leaf) => {
      const node = leaf as d3.HierarchyRectangularNode<any>;
      const stat = node.data as LangStat & { value: number };
      const blockWidth = node.x1 - node.x0;
      const blockHeight = node.y1 - node.y0;
      const group = svg.append("g");

      group.attr("data-lang", stat.lang);

      group
        .append("rect")
        .attr("x", node.x0)
        .attr("y", node.y0)
        .attr("width", blockWidth)
        .attr("height", blockHeight)
        .attr("rx", Math.min(6, Math.min(blockWidth, blockHeight) * 0.18))
        .attr("fill", getLanguageColor(stat.lang))
        .attr("opacity", 0.88)
        .style("cursor", "pointer")
        .style("transition", "opacity 0.2s ease, filter 0.2s ease");

      const textStartX = node.x0 + 8;
      const textStartY = node.y0 + 16;
      const availableTextWidth = blockWidth - 16;
      const availableTextHeight = blockHeight - 14;

      if (availableTextWidth > 24 && availableTextHeight > 16) {
        const labelMaxLines = availableTextHeight >= 44 ? 2 : 1;
        const labelLines = layoutTreemapText(
          stat.lang,
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
          const metaLine = layoutTreemapText(
            `${formatCompact(stat.lines)} 行`,
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
                stat,
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
                stat,
              });
            }
          }
        })
        .on("mouseleave", function () {
          if (!isMobile) {
            d3.select(this)
              .select("rect")
              .attr("opacity", 0.88)
              .style("filter", "none");
            setTooltip(null);
          }
        });
    });
    svg.on("mouseleave", () => setTooltip(null));
  }, [data, isMobile]);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return;
    }

    tooltipSizeRef.current = {
      width: tooltipRef.current.offsetWidth,
      height: tooltipRef.current.offsetHeight,
    };
  }, [tooltip]);

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg ref={svgRef} width="100%" className="min-h-65" />
      {!isMobile && tooltip && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 min-w-52 max-w-[min(22rem,calc(100%-1rem))] rounded-xl border border-border/60 bg-popover/95 p-3 text-xs text-popover-foreground shadow-glass backdrop-blur-xl"
          style={getTooltipPosition(
            tooltip.x,
            tooltip.y,
            tooltipSizeRef.current,
            containerRef.current?.getBoundingClientRect(),
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-semibold text-primary-900 dark:text-primary-900">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: getLanguageColor(tooltip.stat.lang) }}
              />
              {tooltip.stat.lang}
            </span>
            <span className="text-primary-600 dark:text-primary-600">
              {formatFull(tooltip.stat.lines)}
              {" "}
              行
            </span>
          </div>
          <StackBar
            code={tooltip.stat.code}
            comments={tooltip.stat.comments}
            blanks={tooltip.stat.blanks}
            total={tooltip.stat.lines}
          />
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-primary-700 dark:text-primary-700">
            <span>文件</span>
            <span>{formatFull(tooltip.stat.files)}</span>
            <span>代码</span>
            <span>{formatFull(tooltip.stat.code)}</span>
            <span>注释</span>
            <span>{formatFull(tooltip.stat.comments)}</span>
            <span>空行</span>
            <span>{formatFull(tooltip.stat.blanks)}</span>
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

function TokeiTable({ data }: { data: LangStat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-primary-500 dark:text-primary-500">
          <tr>
            <th className="pb-3 font-medium">语言</th>
            <th className="pb-3 font-medium">文件</th>
            <th className="pb-3 font-medium">总行数</th>
            <th className="pb-3 font-medium">代码</th>
            <th className="pb-3 font-medium">注释</th>
            <th className="pb-3 font-medium">空行</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {data.map(stat => (
            <tr
              key={stat.lang}
              className="transition-colors duration-200 hover:bg-accent-50/50 dark:hover:bg-accent-950/20"
            >
              <td className="py-3 pr-4">
                <span className="inline-flex items-center gap-2 font-medium text-primary-900 dark:text-primary-900">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: getLanguageColor(stat.lang) }}
                  />
                  {stat.lang}
                </span>
              </td>
              <td className="py-3 pr-4 text-primary-700 dark:text-primary-700">
                {stat.files.toLocaleString()}
              </td>
              <td className="py-3 pr-4 text-primary-700 dark:text-primary-700">
                {formatCompact(stat.lines)}
              </td>
              <td className="py-3 pr-4 text-primary-700 dark:text-primary-700">
                {formatCompact(stat.code)}
              </td>
              <td className="py-3 pr-4 text-primary-700 dark:text-primary-700">
                {formatCompact(stat.comments)}
              </td>
              <td className="py-3 text-primary-700 dark:text-primary-700">
                {formatCompact(stat.blanks)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
