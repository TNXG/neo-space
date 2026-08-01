"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  type BangumiImageSource,
  benchmarkBangumiRoutes,
  benchmarkCdnRoutes,
  type CdnHostname,
  getServiceWorkerStatus,
  hasServiceWorkerOptOut,
  installServiceWorkerWithRecommendation,
  isServiceWorkerSupported,
  pingServiceWorker,
  type ResourceBenchmarkResult,
  type ServiceWorkerConfig,
  setServiceWorkerConfig,
  uninstallServiceWorker,
} from "@/lib/service-worker/client";

export type ServiceWorkerUiState =
  | "checking"
  | "unsupported"
  | "opted-out"
  | "missing"
  | "installing"
  | "active"
  | "error";

const DEFAULT_CONFIG: ServiceWorkerConfig = {
  cdnHostname: "cdn.tnxg.top",
  bangumiImageSource: "native",
};
interface UseServiceWorkerSettingsResult {
  state: ServiceWorkerUiState;
  version: string | null;
  workerLatencyMs: number | null;
  config: ServiceWorkerConfig;
  benchmarkResults: Record<string, ResourceBenchmarkResult>;
  isBenchmarkingCdn: boolean;
  isBenchmarkingBangumi: boolean;
  install: () => Promise<void>;
  uninstall: () => Promise<void>;
  selectCdnHostname: (hostname: CdnHostname) => Promise<void>;
  selectBangumiSource: (source: BangumiImageSource) => Promise<void>;
  benchmarkCdn: () => Promise<void>;
  benchmarkBangumi: () => Promise<void>;
}

/** 管理配置页所需的 Worker 生命周期、RPC 状态与资源测速。 */
export function useServiceWorkerSettings(): UseServiceWorkerSettingsResult {
  const t = useTranslations("serviceWorker");
  const [state, setState] = useState<ServiceWorkerUiState>("checking");
  const [version, setVersion] = useState<string | null>(null);
  const [workerLatencyMs, setWorkerLatencyMs] = useState<number | null>(null);
  const [config, setConfig] = useState<ServiceWorkerConfig>(DEFAULT_CONFIG);
  const [benchmarkResults, setBenchmarkResults] = useState<
    Record<string, ResourceBenchmarkResult>
  >({});
  const [isBenchmarkingCdn, setIsBenchmarkingCdn] = useState(false);
  const [isBenchmarkingBangumi, setIsBenchmarkingBangumi] = useState(false);

  /** 重新读取浏览器注册状态与 Worker RPC 心跳。 */
  const refreshStatus = useCallback(async () => {
    if (!isServiceWorkerSupported()) {
      setState("unsupported");
      return;
    }

    if (hasServiceWorkerOptOut()) {
      setState("opted-out");
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) {
      setState("missing");
      return;
    }

    if (!registration.active) {
      setState("installing");
      return;
    }

    try {
      const [runtimeStatus, latencyMs] = await Promise.all([
        getServiceWorkerStatus(),
        pingServiceWorker(),
      ]);
      setVersion(runtimeStatus.version);
      setConfig(runtimeStatus.config);
      setWorkerLatencyMs(latencyMs);
      setState("active");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    navigator.serviceWorker?.addEventListener(
      "controllerchange",
      refreshStatus,
    );
    const refreshTimer = window.setTimeout(() => void refreshStatus(), 2_500);

    return () => {
      window.clearTimeout(refreshTimer);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        refreshStatus,
      );
    };
  }, [refreshStatus]);

  /** 安装 Service Worker 并在激活后刷新状态。 */
  const install = useCallback(async () => {
    setState("installing");
    try {
      const recommendation = await installServiceWorkerWithRecommendation();
      if (recommendation) {
        setConfig(recommendation.config);
        setBenchmarkResults(
          Object.fromEntries(
            recommendation.results.map((result) => [result.key, result]),
          ),
        );
      }
      await refreshStatus();
      toast.success(t("toast.installed"));
    } catch {
      setState("error");
      toast.error(t("toast.installFailed"));
    }
  }, [refreshStatus, t]);

  /** 卸载 Service Worker，并保留用户明确停用的偏好。 */
  const uninstall = useCallback(async () => {
    try {
      await uninstallServiceWorker();
      setVersion(null);
      setWorkerLatencyMs(null);
      setState("opted-out");
      toast.success(t("toast.uninstalled"));
    } catch {
      toast.error(t("toast.uninstallFailed"));
    }
  }, [t]);

  /** 将完整配置同步到 Worker，并更新页面显示。 */
  const updateConfig = useCallback(
    async (nextConfig: ServiceWorkerConfig) => {
      try {
        const runtimeStatus = await setServiceWorkerConfig(nextConfig);
        setConfig(runtimeStatus.config);
        setVersion(runtimeStatus.version);
        toast.success(t("toast.configUpdated"));
      } catch {
        toast.error(t("toast.configFailed"));
      }
    },
    [t],
  );

  /** 选择通用 CDN 资源域名。 */
  const selectCdnHostname = useCallback(
    async (hostname: CdnHostname) => {
      await updateConfig({ ...config, cdnHostname: hostname });
    },
    [config, updateConfig],
  );

  /** 选择 Bangumi 图片来源。 */
  const selectBangumiSource = useCallback(
    async (source: BangumiImageSource) => {
      await updateConfig({ ...config, bangumiImageSource: source });
    },
    [config, updateConfig],
  );

  /** 并行测试两个 CDN 节点，确保使用同一文件进行可比测速。 */
  const benchmarkCdn = useCallback(async () => {
    setIsBenchmarkingCdn(true);
    try {
      const results = await benchmarkCdnRoutes();
      setBenchmarkResults((current) => ({
        ...current,
        ...Object.fromEntries(results.map((result) => [result.key, result])),
      }));
    } finally {
      setIsBenchmarkingCdn(false);
    }
  }, []);

  /** 并行测试 Bangumi 原生、本站代理与第三方镜像线路。 */
  const benchmarkBangumi = useCallback(async () => {
    setIsBenchmarkingBangumi(true);
    try {
      const results = await benchmarkBangumiRoutes();
      setBenchmarkResults((current) => ({
        ...current,
        ...Object.fromEntries(results.map((result) => [result.key, result])),
      }));
    } finally {
      setIsBenchmarkingBangumi(false);
    }
  }, []);

  return {
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
  };
}
