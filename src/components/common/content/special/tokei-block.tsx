"use client";

import type { LangStat, PointerTooltipPosition } from "./types";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  InvalidBlock,
  Metric,
  SpecialBlockHeader,
  TokeiPopoverBody,
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
  getLanguageColor,
  layoutTreemapText,
  parseTokei,
  percentage,
} from "./utils";

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

      <div className="flex flex-col gap-3 border-t border-border/60 bg-zinc-50/70 px-4 py-3 text-sm dark:bg-primary-200/50 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex flex-wrap gap-3 text-primary-700 dark:text-primary-700">
          <Metric label="Files" value={formatCompact(totals.files)} />
          <Metric label="Lines" value={formatCompact(totals.lines)} />
          <Metric label="Code" value={formatCompact(totals.code)} />
          <Metric
            label="Comments"
            value={`${percentage(totals.comments, totals.lines)}%`}
          />
        </div>

        <a
          href="https://github.com/XAMPPRocky/tokei"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 transition-colors hover:text-accent-800"
        >
          tokei
        </a>
      </div>
    </section>
  );
}

function TokeiTreemap({ data }: { data: LangStat[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    position: PointerTooltipPosition;
    stat: LangStat;
  } | null>(null);
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
            `${formatCompact(stat.lines)} lines`,
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
        .on("mouseenter", function (event) {
          if (!isMobile) {
            d3.select(this)
              .select("rect")
              .attr("opacity", 1)
              .style("filter", "brightness(1.15)");
            setTooltip({
              position: { clientX: event.clientX, clientY: event.clientY },
              stat,
            });
          }
        })
        .on("mousemove", (event) => {
          if (!isMobile) {
            setTooltip({
              position: { clientX: event.clientX, clientY: event.clientY },
              stat,
            });
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
  }, [data, isMobile]);

  return (
    <div className="relative">
      <svg ref={svgRef} width="100%" className="min-h-65" />
      {!isMobile && (
        <Popover
          open={Boolean(tooltip)}
          onOpenChange={open => !open && setTooltip(null)}
        >
          {tooltip && (
            <PopoverAnchor asChild>
              <span
                aria-hidden
                className="pointer-events-none fixed h-0 w-0"
                style={{
                  left: clampNumber(
                    tooltip.position.clientX + 12,
                    16,
                    Math.max(16, window.innerWidth - 16),
                  ),
                  top: clampNumber(
                    tooltip.position.clientY - 8,
                    16,
                    Math.max(16, window.innerHeight - 16),
                  ),
                }}
              />
            </PopoverAnchor>
          )}
          <PopoverContent
            side="right"
            align="start"
            sideOffset={0}
            className="pointer-events-none min-w-52 max-w-[min(22rem,calc(100vw-2rem))] p-3 text-xs"
          >
            {tooltip && <TokeiPopoverBody stat={tooltip.stat} />}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function TokeiTable({ data }: { data: LangStat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-primary-500 dark:text-primary-500">
          <tr>
            <th className="pb-3 font-medium">Language</th>
            <th className="pb-3 font-medium">Files</th>
            <th className="pb-3 font-medium">Lines</th>
            <th className="pb-3 font-medium">Code</th>
            <th className="pb-3 font-medium">Comments</th>
            <th className="pb-3 font-medium">Blanks</th>
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
