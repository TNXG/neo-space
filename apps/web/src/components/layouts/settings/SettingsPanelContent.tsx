"use client";

import { useTranslations } from "next-intl";

import { SettingsRouteSection } from "@/components/layouts/settings/SettingsRouteSection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ServiceWorkerUiState } from "@/hooks/useServiceWorkerSettings";
import { Icon } from "@/lib/inline-icon";
import type {
  BangumiImageSource,
  CdnHostname,
  ResourceBenchmarkResult,
  ServiceWorkerConfig,
} from "@/lib/service-worker/client";

interface SettingsPanelContentProps {
  state: ServiceWorkerUiState;
  version: string | null;
  workerLatencyMs: number | null;
  config: ServiceWorkerConfig;
  benchmarkResults: Record<string, ResourceBenchmarkResult>;
  isBenchmarkingCdn: boolean;
  isBenchmarkingBangumi: boolean;
  onInstall: () => void;
  onSelectCdnHostname: (hostname: CdnHostname) => void;
  onSelectBangumiSource: (source: BangumiImageSource) => void;
  onBenchmarkCdn: () => void;
  onBenchmarkBangumi: () => void;
}

/** 展示可在桌面模态框和移动端底部面板之间复用的配置内容。 */
export function SettingsPanelContent({
  state,
  version,
  workerLatencyMs,
  config,
  benchmarkResults,
  isBenchmarkingCdn,
  isBenchmarkingBangumi,
  onInstall,
  onSelectCdnHostname,
  onSelectBangumiSource,
  onBenchmarkCdn,
  onBenchmarkBangumi,
}: SettingsPanelContentProps) {
  const t = useTranslations("serviceWorker");
  const isActive = state === "active";
  const canInstall = ["missing", "opted-out", "error"].includes(state);
  const statusVariant =
    state === "active"
      ? "default"
      : state === "error" || state === "unsupported"
        ? "destructive"
        : "secondary";
  const cdnOptions = [
    {
      value: "cdn.tnxg.top",
      label: "cdn.tnxg.top",
      description: t("cdn.primaryDescription"),
    },
    {
      value: "cdcn.tnxg.top",
      label: "cdcn.tnxg.top",
      description: t("cdn.alternativeDescription"),
    },
  ];
  const bangumiOptions = [
    {
      value: "native",
      label: t("bangumi.native"),
      description: t("bangumi.nativeDescription"),
    },
    {
      value: "proxy",
      label: t("bangumi.proxy"),
      description: t("bangumi.proxyDescription"),
    },
    {
      value: "mirror",
      label: "bgmimg.anibt.net",
      description: t("bangumi.mirrorDescription"),
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 rounded-2xl bg-secondary/45 px-3.5 py-3 sm:flex sm:items-center sm:px-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80 text-accent-600 shadow-sm">
          <Icon
            icon={
              isActive ? "mingcute:check-circle-line" : "mingcute:warning-line"
            }
            className="text-lg"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{t("status.title")}</h3>
            <Badge variant={statusVariant}>{t(`state.${state}`)}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isActive
              ? t("statusSummary", {
                  version: version ?? "—",
                  latency: workerLatencyMs?.toFixed(1) ?? "—",
                })
              : t(`stateDescription.${state}`)}
          </p>
        </div>
        {canInstall && (
          <Button
            type="button"
            size="sm"
            className="col-start-2 min-h-11 w-full cursor-pointer sm:min-h-0 sm:w-auto"
            onClick={onInstall}
          >
            {t("install")}
          </Button>
        )}
      </section>

      {!isActive && state === "unsupported" && (
        <Alert variant="destructive">
          <AlertTitle>{t("installRequired")}</AlertTitle>
          <AlertDescription>
            {t("stateDescription.unsupported")}
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      <SettingsRouteSection
        title={t("cdn.title")}
        description={t("cdn.description")}
        value={config.cdnHostname}
        options={cdnOptions}
        results={benchmarkResults}
        disabled={!isActive}
        isBenchmarking={isBenchmarkingCdn}
        onValueChange={(value) => onSelectCdnHostname(value as CdnHostname)}
        onBenchmark={onBenchmarkCdn}
      />

      <Separator />

      <SettingsRouteSection
        title={t("bangumi.title")}
        description={t("bangumi.description")}
        value={config.bangumiImageSource}
        options={bangumiOptions}
        results={benchmarkResults}
        disabled={!isActive}
        isBenchmarking={isBenchmarkingBangumi}
        onValueChange={(value) =>
          onSelectBangumiSource(value as BangumiImageSource)
        }
        onBenchmark={onBenchmarkBangumi}
      />
    </div>
  );
}
