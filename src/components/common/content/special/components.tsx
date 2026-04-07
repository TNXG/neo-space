"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { FUNCTION_COLORS } from "./constants";
import { formatBytes, formatFull, getLanguageColor, percentage } from "./utils";

export function SpecialBlockHeader<T extends string>({
  title,
  subtitle,
  view,
  onViewChange,
  views,
}: {
  title: string;
  subtitle: string;
  view: T;
  onViewChange: (view: T) => void;
  views: Array<{ key: T; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 bg-zinc-50/70 px-4 py-3 dark:bg-primary-200/50 md:flex-row md:items-center md:justify-between md:px-5">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-primary-900 dark:text-primary-900">
          {title}
        </div>
        <div className="text-xs text-primary-600 dark:text-primary-600">
          {subtitle}
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-white/80 p-1 shadow-sm ring-1 ring-border/60 dark:bg-primary-100/80">
        {views.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onViewChange(item.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === item.key
                ? "bg-accent-600 text-white shadow-sm"
                : "text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-primary-500 dark:text-primary-500">{label}</span>
      <span className="font-semibold text-primary-900 dark:text-primary-900">
        {value}
      </span>
    </span>
  );
}

export function CargoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 transition-colors hover:text-accent-800"
    >
      {label}
      <Icon icon="mingcute:arrow-right-up-line" className="size-4" />
    </a>
  );
}

export function StackBar({
  code,
  comments,
  blanks: _blanks,
  total,
}: {
  code: number;
  comments: number;
  blanks: number;
  total: number;
}) {
  const codeWidth = percentage(code, total);
  const commentsWidth = percentage(comments, total);
  const blanksWidth = Math.max(0, 100 - codeWidth - commentsWidth);

  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-primary-200 dark:bg-primary-200">
      <div
        style={{
          width: `${codeWidth}%`,
          backgroundColor: FUNCTION_COLORS.code,
        }}
      />
      <div
        style={{
          width: `${commentsWidth}%`,
          backgroundColor: FUNCTION_COLORS.comments,
        }}
      />
      <div
        style={{
          width: `${blanksWidth}%`,
          backgroundColor: FUNCTION_COLORS.blanks,
        }}
      />
    </div>
  );
}

export function CargoLoadingSkeleton() {
  return (
    <div className="px-4 py-4 md:px-5">
      <div className="grid h-65 grid-cols-4 grid-rows-3 gap-2">
        <Skeleton className="col-span-2 row-span-2 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
        <Skeleton className="col-span-1 row-span-2 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
        <Skeleton className="col-span-2 row-span-1 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
        <Skeleton className="col-span-1 row-span-1 rounded-lg" />
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-14 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

export function InvalidBlock({ title, raw }: { title: string; raw: string }) {
  return (
    <section className="my-5 md:my-6 overflow-hidden rounded-2xl border border-red-200 bg-red-50/80 shadow-sm dark:border-red-900/40 dark:bg-red-950/20">
      <div className="border-b border-red-200/70 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:text-red-300">
        {title}
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-red-900 dark:text-red-100">
        <code>{raw}</code>
      </pre>
    </section>
  );
}

export function TokeiPopoverBody({ stat }: { stat: { lang: string; files: number; lines: number; code: number; comments: number; blanks: number } }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-semibold text-primary-900 dark:text-primary-900">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: getLanguageColor(stat.lang) }}
          />
          {stat.lang}
        </span>
        <span className="text-primary-600 dark:text-primary-600">
          {formatFull(stat.lines)}
          {" "}
          lines
        </span>
      </div>
      <StackBar
        code={stat.code}
        comments={stat.comments}
        blanks={stat.blanks}
        total={stat.lines}
      />
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-primary-700 dark:text-primary-700">
        <span>Files</span>
        <span>{formatFull(stat.files)}</span>
        <span>Code</span>
        <span>{formatFull(stat.code)}</span>
        <span>Comments</span>
        <span>{formatFull(stat.comments)}</span>
        <span>Blanks</span>
        <span>{formatFull(stat.blanks)}</span>
      </div>
    </>
  );
}

export function CargoPopoverBody({ dep }: { dep: { name: string; version: string; kind: string; optional: boolean; crate_size: number | null; depth: number; target: string | null } }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-semibold text-primary-900 dark:text-primary-900">
          {dep.name}
        </span>
        <span className="text-primary-600 dark:text-primary-600">
          {dep.version}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-primary-700 dark:text-primary-700">
        <span>Kind</span>
        <span>{dep.optional ? `${dep.kind} (optional)` : dep.kind}</span>
        <span>Size</span>
        <span>
          {dep.crate_size != null ? formatBytes(dep.crate_size) : "unknown"}
        </span>
        <span>Depth</span>
        <span>{dep.depth === 0 ? "direct" : `transitive (${dep.depth})`}</span>
        {dep.target && (
          <>
            <span>Target</span>
            <span>{dep.target}</span>
          </>
        )}
      </div>
    </>
  );
}
