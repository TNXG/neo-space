import { isIP } from "node:net";
import { Agent, Dispatcher, ProxyAgent, Socks5ProxyAgent } from "undici";

export interface ActiveNetworkOptions {
  proxyUrl: string;
  bypassOrigins: string[];
}

/** Match Rust's literal-address and local-service bypass; do not perform DNS-based bypass. */
export function bypassProxy(url: URL, origins: readonly string[]) {
  if (origins.includes(url.origin)) return true;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) === 4) {
    const [a = -1, b = -1] = host.split(".").map(Number);
    return host === "0.0.0.0" || a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (isIP(host) === 6) {
    if (host === "::" || host === "::1" || /^(?:fc|fd)/.test(host) || /^fe[89ab]/.test(host)) return true;
    // WHATWG URL canonicalizes mapped IPv4 into the final two hexadecimal groups.
    const mapped = /^::ffff:([a-f\d]+):([a-f\d]+)$/.exec(host);
    if (!mapped) return false;
    const high = Number.parseInt(mapped[1] || "0", 16);
    const low = Number.parseInt(mapped[2] || "0", 16);
    return bypassProxy(new URL(`http://${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`), []);
  }
  return !host.includes(".") || host.endsWith(".localhost") || host.endsWith(".local");
}

/**
 * Validate credentials privately and construct the matching proxy transport.
 * HTTP(S) uses Proxy-Authorization; SOCKS5 uses RFC 1929 credentials and always resolves the
 * target hostname at the proxy (matching Rust's socks5h behavior).
 */
function createProxy(proxyUrl: string): Dispatcher {
  const url = new URL(proxyUrl);
  if (url.search || url.hash) throw new Error("Invalid active outbound proxy configuration");
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (url.protocol === "http:" || url.protocol === "https:") {
    if (url.pathname !== "/") throw new Error("Invalid active outbound proxy configuration");
    const token = username || password
      ? `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
      : undefined;
    url.username = "";
    url.password = "";
    return new ProxyAgent({ uri: url.href, token });
  }
  if (url.protocol === "socks5:" || url.protocol === "socks5h:") {
    if (url.pathname !== "" && url.pathname !== "/") throw new Error("Invalid active outbound proxy configuration");
    url.protocol = "socks5:";
    url.pathname = "/";
    if (!url.port) url.port = "1080";
    url.username = "";
    url.password = "";
    return new Socks5ProxyAgent(url.href, {
      username: username || undefined,
      password: password || undefined,
    });
  }
  throw new Error("Invalid active outbound proxy configuration");
}

/** A process-global dispatcher covers native fetch and Next's cache-aware patched fetch. */
export class OutboundDispatcher extends Dispatcher {
  private readonly direct = new Agent();
  private proxy?: Dispatcher;
  private proxyUrl?: string;

  constructor(
    private readonly loadOptions: () => Promise<ActiveNetworkOptions>,
    private readonly internalOrigins: readonly string[],
  ) {
    super();
  }

  /** Dispatch local topology immediately; external traffic fails closed if configuration is unavailable. */
  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean {
    const target = new URL(String(options.origin));
    if (bypassProxy(target, this.internalOrigins)) return this.direct.dispatch(options, handler);
    const safeHandler = new Proxy(handler, {
      get(targetHandler, property) {
        if (property === "onError" && targetHandler.onError) {
          return () => targetHandler.onError?.(new Error("Server outbound proxy request failed"));
        }
        if (property === "onResponseError" && targetHandler.onResponseError) {
          return (controller: Dispatcher.DispatchController) => targetHandler.onResponseError?.(controller, new Error("Server outbound proxy request failed"));
        }
        const value: unknown = Reflect.get(targetHandler, property);
        return typeof value === "function" ? value.bind(targetHandler) : value;
      },
    });
    void this.loadOptions().then((config) => {
      if (bypassProxy(target, config.bypassOrigins) || !config.proxyUrl) {
        this.direct.dispatch(options, handler);
        return;
      }
      if (this.proxyUrl !== config.proxyUrl) {
        const next = createProxy(config.proxyUrl);
        const previous = this.proxy;
        this.proxy = next;
        this.proxyUrl = config.proxyUrl;
        void previous?.close().catch(() => {});
      }
      const proxy = this.proxy;
      if (!proxy) throw new Error("Missing outbound proxy transport");
      proxy.dispatch(options, safeHandler);
    }).catch(() => {
      // Underlying errors can contain a credential-bearing proxy URI. Never forward their causes.
      handler.onError?.(new Error("Server outbound network configuration or proxy connection failed"));
    });
    return true;
  }

  /** Drain owned pools when a process or a local test shuts down. */
  async close() {
    await Promise.all([this.direct.close(), this.proxy?.close()]);
  }
}
