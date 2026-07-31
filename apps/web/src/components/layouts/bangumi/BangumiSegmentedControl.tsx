import { cn } from "@/lib/utils";

export interface BangumiSegmentOption<T extends string | number> {
  value: T;
  label: string;
  count?: number;
}

interface BangumiSegmentedControlProps<T extends string | number> {
  value: T;
  options: Array<BangumiSegmentOption<T>>;
  onChange: (value: T) => void;
  label: string;
  compact?: boolean;
}

/** 提供可横向滚动的分段控制，移动端保持单行且不压缩触控区域。 */
export function BangumiSegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  label,
  compact = false,
}: BangumiSegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-border/40 bg-card/40 p-1 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl font-medium transition-[background-color,color] duration-200 active:scale-[0.98]",
              compact ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" && (
              <span className={cn("text-[10px] tabular-nums", active ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
