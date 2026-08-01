/* Neo-Space Service Worker：只负责资源线路切换，不缓存页面与首屏内容。 */

const SERVICE_WORKER_VERSION = "1.1.0";
const MANAGED_CACHE_PREFIX = "neo-space-service-worker-";
const CONFIG_CACHE_NAME = "neo-space-service-worker-config-v1";
const CONFIG_REQUEST_URL = new URL("/__service-worker/config", self.location.origin).href;
const CDN_HOSTNAMES = new Set(["cdn.tnxg.top", "cdcn.tnxg.top"]);
const BANGUMI_IMAGE_HOSTNAMES = new Set(["lain.bgm.tv", "bgmimg.anibt.net"]);
const DEFAULT_CONFIG = {
  cdnHostname: "cdn.tnxg.top",
  bangumiImageSource: "native",
};

let runtimeConfigPromise;

/** 从 Cache Storage 读取用户线路配置。 */
async function readConfig() {
  const configCache = await caches.open(CONFIG_CACHE_NAME);
  const configResponse = await configCache.match(CONFIG_REQUEST_URL);

  if (!configResponse) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    return validateConfig(await configResponse.json());
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** 校验来自客户端的配置，防止 Worker 被写入任意代理域名。 */
function validateConfig(candidate) {
  const cdnHostname = CDN_HOSTNAMES.has(candidate?.cdnHostname)
    ? candidate.cdnHostname
    : DEFAULT_CONFIG.cdnHostname;
  const bangumiImageSource = ["native", "proxy", "mirror"].includes(
    candidate?.bangumiImageSource,
  )
    ? candidate.bangumiImageSource
    : DEFAULT_CONFIG.bangumiImageSource;

  return { cdnHostname, bangumiImageSource };
}

/** 持久化线路配置，并立即更新当前 Worker 实例。 */
async function writeConfig(candidate) {
  const nextConfig = validateConfig(candidate);
  const configCache = await caches.open(CONFIG_CACHE_NAME);
  await configCache.put(
    CONFIG_REQUEST_URL,
    new Response(JSON.stringify(nextConfig), {
      headers: { "content-type": "application/json" },
    }),
  );
  runtimeConfigPromise = Promise.resolve(nextConfig);
  return nextConfig;
}

/** 获取当前运行配置，避免每个资源请求重复读取 Cache Storage。 */
function getConfig() {
  runtimeConfigPromise ??= readConfig();
  return runtimeConfigPromise;
}

/** 按用户选择生成替代资源 URL；返回 null 表示不拦截。 */
function createRewrittenUrl(requestUrl, requestDestination, config) {
  if (requestUrl.searchParams.has("sw-bypass")) {
    return null;
  }

  if (CDN_HOSTNAMES.has(requestUrl.hostname)) {
    if (requestUrl.hostname === config.cdnHostname) {
      return null;
    }

    const rewrittenUrl = new URL(requestUrl);
    rewrittenUrl.hostname = config.cdnHostname;
    return rewrittenUrl;
  }

  if (
    requestDestination !== "image"
    || !BANGUMI_IMAGE_HOSTNAMES.has(requestUrl.hostname)
    || config.bangumiImageSource === "native"
  ) {
    return null;
  }

  if (config.bangumiImageSource === "mirror") {
    const rewrittenUrl = new URL(requestUrl);
    rewrittenUrl.hostname = "bgmimg.anibt.net";
    return rewrittenUrl;
  }

  const proxyUrl = new URL("https://api-space.tnxg.top/images/proxy");
  proxyUrl.searchParams.set("url", requestUrl.href);
  return proxyUrl;
}

/** 优先请求用户线路；线路失败时回退到页面原始 URL。 */
async function fetchWithFallback(request) {
  const config = await getConfig();
  const rewrittenUrl = createRewrittenUrl(
    new URL(request.url),
    request.destination,
    config,
  );

  if (!rewrittenUrl) {
    return fetch(request);
  }

  try {
    const rewrittenResponse = await fetch(new Request(rewrittenUrl, request));
    if (rewrittenResponse.ok || rewrittenResponse.type === "opaque") {
      return rewrittenResponse;
    }
  } catch {
    // 替代线路不可用时继续请求原始资源，避免配置错误破坏页面。
  }

  return fetch(request);
}

/** 将 RPC 结果回复给发起消息的客户端。 */
function replyToClient(event, payload) {
  event.ports[0]?.postMessage(payload);
}

/** 清理已经废弃的 Worker 缓存，同时保留跨版本共享的用户线路配置。 */
async function cleanupObsoleteCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(cacheName => (
        cacheName.startsWith(MANAGED_CACHE_PREFIX)
        && cacheName !== CONFIG_CACHE_NAME
      ))
      .map(cacheName => caches.delete(cacheName)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      cleanupObsoleteCaches(),
      getConfig(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (
    !CDN_HOSTNAMES.has(requestUrl.hostname)
    && !BANGUMI_IMAGE_HOSTNAMES.has(requestUrl.hostname)
  ) {
    return;
  }

  event.respondWith(fetchWithFallback(event.request));
});

self.addEventListener("message", (event) => {
  const message = event.data;

  if (message?.type === "GET_STATUS") {
    event.waitUntil(
      getConfig().then(config => replyToClient(event, {
        ok: true,
        version: SERVICE_WORKER_VERSION,
        config,
      })),
    );
    return;
  }

  if (message?.type === "SET_CONFIG") {
    event.waitUntil(
      writeConfig(message.config).then(config => replyToClient(event, {
        ok: true,
        version: SERVICE_WORKER_VERSION,
        config,
      })),
    );
    return;
  }

  if (message?.type === "PING") {
    replyToClient(event, {
      ok: true,
      version: SERVICE_WORKER_VERSION,
      timestamp: Date.now(),
    });
    return;
  }

  if (message?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (message?.type === "UNINSTALL") {
    event.waitUntil(
      caches.delete(CONFIG_CACHE_NAME).then(async () => {
        replyToClient(event, { ok: true, version: SERVICE_WORKER_VERSION });
        await self.registration.unregister();
      }),
    );
  }
});
