"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { FUNCTION_COLORS } from "./constants";
import { percentage } from "./utils";

const SPECIAL_COLLAPSED_MAX_HEIGHT = 360;

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
  const switchRef = useRef<HTMLDivElement>(null);
  const pointerStartXRef = useRef(0);
  const suppressNextClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const selectViewByPointer = (clientX: number) => {
    const switchElement = switchRef.current;
    if (!switchElement || views.length === 0) {
      return;
    }

    const bounds = switchElement.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const relativeX = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
    const itemIndex = Math.min(
      views.length - 1,
      Math.floor((relativeX / bounds.width) * views.length),
    );

    onViewChange(views[itemIndex].key);
  };

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

      <div
        ref={switchRef}
        className={cn(
          "flex touch-none select-none items-center gap-1 rounded-lg bg-white/80 p-1 shadow-sm ring-1 ring-border/60 dark:bg-primary-100/80",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={(event) => {
          setIsDragging(true);
          pointerStartXRef.current = event.clientX;
          suppressNextClickRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          selectViewByPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!isDragging) {
            return;
          }

          if (Math.abs(event.clientX - pointerStartXRef.current) > 4) {
            suppressNextClickRef.current = true;
          }

          selectViewByPointer(event.clientX);
        }}
        onPointerUp={(event) => {
          setIsDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          setIsDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        {views.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={(event) => {
              if (suppressNextClickRef.current) {
                suppressNextClickRef.current = false;
                event.preventDefault();
                event.stopPropagation();
                return;
              }

              onViewChange(item.key);
            }}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
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

export function SpecialBlockCollapsible({
  children,
  shouldCollapse,
}: {
  children: ReactNode;
  shouldCollapse: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isContentExpanded = !shouldCollapse || isExpanded;

  return (
    <>
      <div
        className={cn(
          "relative",
          !isContentExpanded && "overflow-hidden",
        )}
        style={
          !isContentExpanded
            ? { maxHeight: SPECIAL_COLLAPSED_MAX_HEIGHT }
            : undefined
        }
      >
        {children}
        {!isContentExpanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-primary-100 dark:via-primary-100/85" />
        )}
      </div>

      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setIsExpanded(value => !value)}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-border/60 bg-zinc-50/70 px-3 py-2 text-xs font-medium text-primary-600 transition-colors hover:bg-accent-50 hover:text-accent-700 dark:bg-primary-200/50 dark:hover:bg-primary-300/50"
          aria-expanded={isContentExpanded}
        >
          <Icon
            icon="mingcute:down-line"
            className={cn(
              "size-4 transition-transform duration-200",
              isContentExpanded && "rotate-180",
            )}
          />
          {isContentExpanded ? "收起表格" : "展开完整表格"}
        </button>
      )}
    </>
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
