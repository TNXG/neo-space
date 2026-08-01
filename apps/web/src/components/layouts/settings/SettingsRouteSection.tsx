"use client";

import type { ResourceBenchmarkResult } from "@/lib/service-worker/client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SettingsRouteOption {
  value: string;
  label: string;
  description: string;
}

interface SettingsRouteSectionProps {
  title: string;
  description: string;
  value: string;
  options: SettingsRouteOption[];
  results: Record<string, ResourceBenchmarkResult>;
  disabled: boolean;
  isBenchmarking: boolean;
  onValueChange: (value: string) => void;
  onBenchmark: () => void;
}

/** 将字节速率格式化为便于比较的 MB/s。 */
const formatSpeed = (bytesPerSecond: number | null): string => {
  if (bytesPerSecond === null) {
    return "—";
  }
  return `${(bytesPerSecond / 1_000_000).toFixed(2)} MB/s`;
};

/** 展示一组紧凑线路选项，让控制项与测速反馈保持空间映射。 */
export function SettingsRouteSection({
  title,
  description,
  value,
  options,
  results,
  disabled,
  isBenchmarking,
  onValueChange,
  onBenchmark,
}: SettingsRouteSectionProps) {
  const t = useTranslations("serviceWorker");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight tracking-tight">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || isBenchmarking}
          onClick={onBenchmark}
          className="shrink-0"
        >
          {isBenchmarking ? t("benchmarking") : t("benchmarkShort")}
        </Button>
      </div>

      <FieldSet disabled={disabled}>
        <FieldLegend className="sr-only">{title}</FieldLegend>
        <FieldGroup className="gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={2}
            value={value}
            disabled={disabled}
            onValueChange={(nextValue) => {
              if (nextValue) {
                onValueChange(nextValue);
              }
            }}
            className={cn(
              "grid w-full grid-cols-1 gap-2",
              options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
            )}
          >
            {options.map((option) => {
              const result = results[option.value];
              return (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className="h-auto min-h-18 cursor-pointer flex-col items-start gap-1 rounded-2xl border bg-background/40 px-3.5 py-3 text-left whitespace-normal backdrop-blur-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98] reduced-transparency:bg-background data-[state=on]:border-accent-500/70 data-[state=on]:bg-accent-500/10 data-[state=on]:shadow-sm"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{option.label}</span>
                    {result && (
                      <Badge variant={result.reachable ? "secondary" : "destructive"}>
                        {result.reachable ? t("reachable") : t("unreachable")}
                      </Badge>
                    )}
                  </span>
                  <span className="text-[0.7rem] leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                  {result && (
                    <span className="mt-1 text-[0.7rem] font-medium text-foreground/80">
                      {Math.round(result.latencyMs)} ms
                      {" · "}
                      {formatSpeed(result.bytesPerSecond)}
                    </span>
                  )}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <FieldDescription className="text-[0.7rem]">{t("benchmarkNote")}</FieldDescription>
        </FieldGroup>
      </FieldSet>
    </section>
  );
}
