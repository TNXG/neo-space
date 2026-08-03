"use client";

import { useTranslations } from "next-intl";

import { SettingsPanelContent } from "@/components/layouts/settings/SettingsPanelContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useServiceWorkerSettings } from "@/hooks/useServiceWorkerSettings";
import { Icon } from "@/lib/inline-icon";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 提供全局配置模态框，并保持资源线路操作集中在当前页面上下文。 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const t = useTranslations("serviceWorker");
  const isMobile = useIsMobile(640);
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
  const panelContent = (
    <SettingsPanelContent
      state={state}
      version={version}
      workerLatencyMs={workerLatencyMs}
      config={config}
      benchmarkResults={benchmarkResults}
      isBenchmarkingCdn={isBenchmarkingCdn}
      isBenchmarkingBangumi={isBenchmarkingBangumi}
      onInstall={() => void install()}
      onSelectCdnHostname={(hostname) => void selectCdnHostname(hostname)}
      onSelectBangumiSource={(source) => void selectBangumiSource(source)}
      onBenchmarkCdn={() => void benchmarkCdn()}
      onBenchmarkBangumi={() => void benchmarkBangumi()}
    />
  );
  const panelActions = (
    <>
      {isActive ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="min-h-11 cursor-pointer sm:min-h-0"
          onClick={() => void uninstall()}
        >
          {t("uninstallShort")}
        </Button>
      ) : (
        <span />
      )}
      <Button
        type="button"
        size="default"
        className="min-h-11 min-w-24 cursor-pointer sm:min-h-0"
        onClick={() => onOpenChange(false)}
      >
        {t("done")}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-background/92 backdrop-blur-2xl reduced-transparency:bg-background reduced-transparency:backdrop-blur-none data-[vaul-drawer-direction=bottom]:h-[min(92dvh,50rem)] data-[vaul-drawer-direction=bottom]:max-h-[92dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[1.75rem]">
          <DrawerHeader className="shrink-0 border-none px-5 pb-3 pt-2">
            <DrawerTitle>{t("title")}</DrawerTitle>
            <DrawerDescription className="mx-auto mt-1 line-clamp-2 max-w-80 leading-relaxed">
              {t("dialogDescription")}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody className="min-h-0 overscroll-contain px-4 pb-5 pt-2 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
            {panelContent}
          </DrawerBody>

          <DrawerFooter className="shrink-0 flex-row items-center justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {panelActions}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

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

        <DialogBody className="min-h-0 pt-2">{panelContent}</DialogBody>

        <DialogFooter className="flex-row justify-between bg-secondary/30 sm:justify-between">
          {panelActions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
