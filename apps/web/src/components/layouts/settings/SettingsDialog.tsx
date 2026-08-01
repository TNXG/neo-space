"use client";

import { useTranslations } from "next-intl";

import { SettingsRouteSection } from "@/components/layouts/settings/SettingsRouteSection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useServiceWorkerSettings } from "@/hooks/useServiceWorkerSettings";
import { Icon } from "@/lib/inline-icon";
import type { BangumiImageSource, CdnHostname } from "@/lib/service-worker/client";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 提供全局配置模态框，并保持资源线路操作集中在当前页面上下文。 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const t = useTranslations("serviceWorker");
  const {
    state,
    version,
    workerLatencyMs,
    config,
    benchmarkResults,
    isBenchmarkingCdn,
    isBenchmarkingBangumi,
    install,
    uninstall,
    selectCdnHostname,
    selectBangumiSource,
    benchmarkCdn,
    benchmarkBangumi,
  } = useServiceWorkerSettings();
  const isActive = state === "active";
  const canInstall = ["missing", "opted-out", "error"].includes(state);
  const statusVariant = state === "active"
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(48rem,calc(100vh-2rem))] gap-0 overflow-hidden bg-background/82 shadow-2xl backdrop-blur-2xl reduced-transparency:bg-background reduced-transparency:backdrop-blur-none sm:max-w-3xl">
        <DialogHeader className="border-none pb-3">
          <div className="flex items-center gap-3 pr-10">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary/80 text-foreground shadow-sm">
              <Icon icon="mingcute:settings-3-line" className="text-lg" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription className="mt-1 leading-relaxed">
                {t("dialogDescription")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-col gap-5 pt-2">
          <section className="flex items-center gap-3 rounded-2xl bg-secondary/45 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80 text-accent-600 shadow-sm">
              <Icon
                icon={isActive ? "mingcute:check-circle-line" : "mingcute:warning-line"}
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
              <Button type="button" size="sm" onClick={() => void install()}>
                {t("install")}
              </Button>
            )}
          </section>

          {!isActive && state === "unsupported" && (
            <Alert variant="destructive">
              <AlertTitle>{t("installRequired")}</AlertTitle>
              <AlertDescription>{t("stateDescription.unsupported")}</AlertDescription>
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
            onValueChange={value => void selectCdnHostname(value as CdnHostname)}
            onBenchmark={() => void benchmarkCdn()}
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
            onValueChange={value => void selectBangumiSource(value as BangumiImageSource)}
            onBenchmark={() => void benchmarkBangumi()}
          />
        </DialogBody>

        <DialogFooter className="flex-row justify-between bg-secondary/30 sm:justify-between">
          {isActive
            ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void uninstall()}>
                  {t("uninstallShort")}
                </Button>
              )
            : <span />}
          <DialogClose asChild>
            <Button type="button" size="sm" variant="secondary">{t("done")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
