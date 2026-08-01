"use client";

export type CdnHostname = "cdn.tnxg.top" | "cdcn.tnxg.top";
export type BangumiImageSource = "native" | "proxy" | "mirror";

export interface ServiceWorkerConfig {
  cdnHostname: CdnHostname;
  bangumiImageSource: BangumiImageSource;
}

export interface ServiceWorkerRuntimeStatus {
  version: string;
  config: ServiceWorkerConfig;
}

interface ServiceWorkerRpcResponse extends Partial<ServiceWorkerRuntimeStatus> {
  ok: boolean;
}

export interface ResourceBenchmarkResult {
  key: string;
  latencyMs: number;
  durationMs: number;
  bytesPerSecond: number | null;
  reachable: boolean;
}

export interface ServiceWorkerRecommendationResult {
  config: ServiceWorkerConfig;
  results: ResourceBenchmarkResult[];
}

interface ResourceBenchmarkOptions {
  fallbackByteLength?: number;
  rangeByteLength?: number;
}

export const SERVICE_WORKER_OPT_OUT_KEY = "neo-space-service-worker-opt-out";

const SERVICE_WORKER_SCRIPT_URL = "/service-worker.js";
const MESSAGE_TIMEOUT_MS = 4_000;
const BENCHMARK_TIMEOUT_MS = 12_000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000;
const UPDATE_CHECK_MINIMUM_GAP_MS = 5 * 60 * 1_000;
const CDN_BENCHMARK_URL =
  "https://cdn.tnxg.top/images/archives/pixiv/121433338_p1.png";
const BANGUMI_BENCHMARK_URL =
  "https://lain.bgm.tv/r/400/pic/cover/l/02/c7/287488_1FJYC.jpg";
const CDN_BENCHMARK_RANGE_BYTES = 4 * 1_024 * 1_024;
const BANGUMI_BENCHMARK_BYTE_LENGTH = 77_635;

let stopUpdateMonitoring: (() => void) | null = null;

/** 判断当前浏览器是否支持 Service Worker。 */
export const isServiceWorkerSupported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator;

/** 判断用户是否明确卸载并停用了 Service Worker。 */
export const hasServiceWorkerOptOut = (): boolean =>
  typeof window !== "undefined" &&
  window.localStorage.getItem(SERVICE_WORKER_OPT_OUT_KEY) === "true";

/** 获取当前页面可通信的 Worker，兼容首次安装后 controller 尚未切换的短窗口。 */
const getMessageTarget = async (): Promise<ServiceWorker> => {
  const registration = await navigator.serviceWorker.ready;
  const worker =
    navigator.serviceWorker.controller ??
    registration.active ??
    registration.waiting ??
    registration.installing;

  if (!worker) {
    throw new Error("Service Worker is not active");
  }

  return worker;
};

/** 通过 MessageChannel 调用 Worker 的 Client Only API。 */
const sendMessage = async (
  message: Record<string, unknown>,
): Promise<ServiceWorkerRpcResponse> => {
  const worker = await getMessageTarget();

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Service Worker response timed out"));
    }, MESSAGE_TIMEOUT_MS);

    messageChannel.port1.onmessage = (
      event: MessageEvent<ServiceWorkerRpcResponse>,
    ) => {
      window.clearTimeout(timeoutId);
      resolve(event.data);
    };

    worker.postMessage(message, [messageChannel.port2]);
  });
};

/** 请求已经下载完成的新版 Worker 立即进入激活阶段。 */
const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
};

/**
 * 持续检查 Worker 更新，并覆盖浏览器可能延迟检查或保留 waiting Worker 的情况。
 *
 * 启动、定时、恢复联网及页面重新可见时都会触发检查，但使用最小间隔避免重复请求。
 */
const monitorServiceWorkerUpdates = (
  registration: ServiceWorkerRegistration,
  checkImmediately: boolean,
): (() => void) => {
  let lastCheckedAt = checkImmediately ? 0 : Date.now();

  const checkForUpdate = async () => {
    if (
      !navigator.onLine ||
      Date.now() - lastCheckedAt < UPDATE_CHECK_MINIMUM_GAP_MS
    ) {
      return;
    }

    lastCheckedAt = Date.now();
    try {
      await registration.update();
      activateWaitingWorker(registration);
    } catch {
      // 离线、网络切换或部署中的短暂失败会由下一轮检查自动恢复。
    }
  };

  const handleUpdateFound = () => {
    const installingWorker = registration.installing;
    if (!installingWorker) {
      return;
    }

    const handleStateChange = () => {
      if (installingWorker.state === "installed") {
        activateWaitingWorker(registration);
      }
    };
    installingWorker.addEventListener("statechange", handleStateChange);
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void checkForUpdate();
    }
  };
  const handleOnline = () => void checkForUpdate();
  const intervalId = window.setInterval(
    () => void checkForUpdate(),
    UPDATE_CHECK_INTERVAL_MS,
  );

  registration.addEventListener("updatefound", handleUpdateFound);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);
  activateWaitingWorker(registration);
  if (checkImmediately) {
    void checkForUpdate();
  }

  return () => {
    window.clearInterval(intervalId);
    registration.removeEventListener("updatefound", handleUpdateFound);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
  };
};

/** 保证同一页面只维护一套更新监听器。 */
const startServiceWorkerUpdateMonitoring = (
  registration: ServiceWorkerRegistration,
  checkImmediately: boolean,
) => {
  stopUpdateMonitoring?.();
  stopUpdateMonitoring = monitorServiceWorkerUpdates(
    registration,
    checkImmediately,
  );
};

/** 安装并激活 Service Worker，同时清除用户的停用标记。 */
export const installServiceWorker =
  async (): Promise<ServiceWorkerRegistration> => {
    if (!isServiceWorkerSupported()) {
      throw new Error("Service Worker is not supported");
    }

    const existingRegistration =
      await navigator.serviceWorker.getRegistration("/");
    window.localStorage.removeItem(SERVICE_WORKER_OPT_OUT_KEY);
    const registration = await navigator.serviceWorker.register(
      SERVICE_WORKER_SCRIPT_URL,
      {
        scope: "/",
        updateViaCache: "none",
      },
    );
    await navigator.serviceWorker.ready;
    startServiceWorkerUpdateMonitoring(
      registration,
      Boolean(existingRegistration),
    );
    return registration;
  };

/** 在首屏完成后空闲注册，避免 Service Worker 安装竞争关键网络资源。 */
export const registerServiceWorkerWhenIdle = (): (() => void) => {
  if (!isServiceWorkerSupported() || hasServiceWorkerOptOut()) {
    return () => undefined;
  }

  let idleCallbackId: number | undefined;
  let timeoutId: number | undefined;
  const idleCallbacks = window as unknown as {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  const register = () => {
    if (idleCallbacks.requestIdleCallback) {
      idleCallbackId = idleCallbacks.requestIdleCallback(
        () =>
          void installServiceWorkerWithRecommendation().catch(() => undefined),
        { timeout: 2_000 },
      );
      return;
    }

    timeoutId = window.setTimeout(
      () =>
        void installServiceWorkerWithRecommendation().catch(() => undefined),
      1_000,
    );
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }

  return () => {
    window.removeEventListener("load", register);
    if (idleCallbackId !== undefined && idleCallbacks.cancelIdleCallback) {
      idleCallbacks.cancelIdleCallback(idleCallbackId);
    }
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    stopUpdateMonitoring?.();
    stopUpdateMonitoring = null;
  };
};

/** 查询 Worker 版本、工作状态和当前线路配置。 */
export const getServiceWorkerStatus =
  async (): Promise<ServiceWorkerRuntimeStatus> => {
    const response = await sendMessage({ type: "GET_STATUS" });
    if (!response.ok || !response.version || !response.config) {
      throw new Error("Invalid Service Worker status response");
    }
    return { version: response.version, config: response.config };
  };

/** 更新 Worker 的资源线路配置。 */
export const setServiceWorkerConfig = async (
  config: ServiceWorkerConfig,
): Promise<ServiceWorkerRuntimeStatus> => {
  const response = await sendMessage({ type: "SET_CONFIG", config });
  if (!response.ok || !response.version || !response.config) {
    throw new Error("Invalid Service Worker config response");
  }
  return { version: response.version, config: response.config };
};

/** 测量 Client 与 Worker 消息往返延迟。 */
export const pingServiceWorker = async (): Promise<number> => {
  const startedAt = performance.now();
  const response = await sendMessage({ type: "PING" });
  if (!response.ok) {
    throw new Error("Service Worker ping failed");
  }
  return performance.now() - startedAt;
};

/** 卸载本站全部 Worker，并写入用户停用标记，防止下次访问自动重装。 */
export const uninstallServiceWorker = async (): Promise<void> => {
  window.localStorage.setItem(SERVICE_WORKER_OPT_OUT_KEY, "true");

  try {
    await sendMessage({ type: "UNINSTALL" });
  } catch {
    // Worker 已失联时仍继续通过 Registration API 完成卸载。
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((registration) => registration.unregister()),
  );
};

/**
 * 测试资源 URL 的首字节延迟与下载速度。
 *
 * CORS 允许读取响应时使用真实字节数计算速度；不可读时仍报告连通性与总耗时。
 */
export const benchmarkResource = async (
  key: string,
  resourceUrl: string,
  options: ResourceBenchmarkOptions = {},
): Promise<ResourceBenchmarkResult> => {
  const benchmarkUrl = new URL(resourceUrl);
  benchmarkUrl.searchParams.set("sw-bypass", String(Date.now()));

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort(),
    BENCHMARK_TIMEOUT_MS,
  );
  const startedAt = performance.now();

  try {
    const response = await fetch(benchmarkUrl, {
      cache: "no-store",
      headers: options.rangeByteLength
        ? { Range: `bytes=0-${options.rangeByteLength - 1}` }
        : undefined,
      signal: abortController.signal,
    });
    const headersReceivedAt = performance.now();
    if (!response.ok) {
      throw new Error(`Resource responded with ${response.status}`);
    }
    const body = await response.arrayBuffer();
    const completedAt = performance.now();
    const downloadSeconds = Math.max(
      (completedAt - headersReceivedAt) / 1_000,
      0.001,
    );

    return {
      key,
      latencyMs: headersReceivedAt - startedAt,
      durationMs: completedAt - startedAt,
      bytesPerSecond: body.byteLength / downloadSeconds,
      reachable: true,
    };
  } catch {
    const imageStartedAt = performance.now();

    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        const imageTimeoutId = window.setTimeout(() => {
          image.src = "";
          reject(new Error("Image benchmark timed out"));
        }, BENCHMARK_TIMEOUT_MS);
        image.onload = () => {
          window.clearTimeout(imageTimeoutId);
          resolve();
        };
        image.onerror = () => {
          window.clearTimeout(imageTimeoutId);
          reject(new Error("Image benchmark failed"));
        };
        image.src = benchmarkUrl.href;
      });
      const completedAt = performance.now();
      const durationMs = completedAt - imageStartedAt;

      return {
        key,
        latencyMs: durationMs,
        durationMs,
        bytesPerSecond: options.fallbackByteLength
          ? options.fallbackByteLength / Math.max(durationMs / 1_000, 0.001)
          : null,
        reachable: true,
      };
    } catch {
      const failedAt = performance.now();
      return {
        key,
        latencyMs: failedAt - startedAt,
        durationMs: failedAt - startedAt,
        bytesPerSecond: null,
        reachable: false,
      };
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/** 使用同一张指定图片并行测试两个通用 CDN 节点。 */
export const benchmarkCdnRoutes = async (): Promise<
  ResourceBenchmarkResult[]
> => {
  const alternativeUrl = new URL(CDN_BENCHMARK_URL);
  alternativeUrl.hostname = "cdcn.tnxg.top";

  return Promise.all([
    benchmarkResource("cdn.tnxg.top", CDN_BENCHMARK_URL, {
      rangeByteLength: CDN_BENCHMARK_RANGE_BYTES,
    }),
    benchmarkResource("cdcn.tnxg.top", alternativeUrl.href, {
      rangeByteLength: CDN_BENCHMARK_RANGE_BYTES,
    }),
  ]);
};

/** 使用同一张指定封面并行测试 Bangumi 原生、本站代理和镜像节点。 */
export const benchmarkBangumiRoutes = async (): Promise<
  ResourceBenchmarkResult[]
> => {
  const proxyUrl = `https://api-space.tnxg.top/images/proxy?url=${encodeURIComponent(BANGUMI_BENCHMARK_URL)}`;
  const mirrorUrl = BANGUMI_BENCHMARK_URL.replace(
    "lain.bgm.tv",
    "bgmimg.anibt.net",
  );
  const fallbackOptions = { fallbackByteLength: BANGUMI_BENCHMARK_BYTE_LENGTH };

  return Promise.all([
    benchmarkResource("native", BANGUMI_BENCHMARK_URL, fallbackOptions),
    benchmarkResource("proxy", proxyUrl, fallbackOptions),
    benchmarkResource("mirror", mirrorUrl, fallbackOptions),
  ]);
};

/**
 * 从可用线路中选出推荐项。
 *
 * 下载速度占 70%，首包延迟占 30%；缺少吞吐量时使用总耗时作为保底排序依据。
 */
const recommendResourceKey = (
  results: ResourceBenchmarkResult[],
): string | null => {
  const reachableResults = results.filter((result) => result.reachable);
  if (reachableResults.length === 0) {
    return null;
  }

  const resultsWithThroughput = reachableResults.filter(
    (result) => result.bytesPerSecond !== null,
  );
  if (resultsWithThroughput.length === 0) {
    return reachableResults.reduce((best, result) =>
      result.durationMs < best.durationMs ? result : best,
    ).key;
  }

  const maximumThroughput = Math.max(
    ...resultsWithThroughput.map((result) => result.bytesPerSecond ?? 0),
  );
  const minimumLatency = Math.max(
    Math.min(...resultsWithThroughput.map((result) => result.latencyMs)),
    0.1,
  );

  return resultsWithThroughput.reduce(
    (best, result) => {
      const throughputScore = (result.bytesPerSecond ?? 0) / maximumThroughput;
      const latencyScore = minimumLatency / Math.max(result.latencyMs, 0.1);
      const score = throughputScore * 0.7 + latencyScore * 0.3;
      return score > best.score ? { key: result.key, score } : best;
    },
    { key: resultsWithThroughput[0].key, score: -1 },
  ).key;
};

/** 测速、选择推荐线路，并通过 Worker Client API 持久化完整配置。 */
export const recommendServiceWorkerConfig =
  async (): Promise<ServiceWorkerRecommendationResult> => {
    const runtimeStatus = await getServiceWorkerStatus();
    const [cdnResults, bangumiResults] = await Promise.all([
      benchmarkCdnRoutes(),
      benchmarkBangumiRoutes(),
    ]);
    const recommendedCdn = recommendResourceKey(
      cdnResults,
    ) as CdnHostname | null;
    const recommendedBangumi = recommendResourceKey(
      bangumiResults,
    ) as BangumiImageSource | null;
    const nextConfig: ServiceWorkerConfig = {
      cdnHostname: recommendedCdn ?? runtimeStatus.config.cdnHostname,
      bangumiImageSource:
        recommendedBangumi ?? runtimeStatus.config.bangumiImageSource,
    };
    const updatedStatus = await setServiceWorkerConfig(nextConfig);

    return {
      config: updatedStatus.config,
      results: [...cdnResults, ...bangumiResults],
    };
  };

/** 仅在首次注册时执行自动测速，避免后续访问覆盖用户的手动选择。 */
export const installServiceWorkerWithRecommendation =
  async (): Promise<ServiceWorkerRecommendationResult | null> => {
    const existingRegistration =
      await navigator.serviceWorker.getRegistration("/");
    await installServiceWorker();

    if (existingRegistration) {
      return null;
    }

    return recommendServiceWorkerConfig();
  };
