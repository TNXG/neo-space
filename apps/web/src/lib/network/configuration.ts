import type { Dispatcher } from "undici";
import type { ActiveNetworkOptions } from "./dispatcher";
import { createHmac } from "node:crypto";
import { fetch } from "undici";

/** Discover direct mode without secrets; retrieving an enabled proxy always requires authentication. */
export async function loadActiveNetworkOptions(baseUrl: string, secret: string | undefined, direct: Dispatcher): Promise<ActiveNetworkOptions> {
  if (!secret) {
    const response = await fetch(`${baseUrl}/internal/network/status`, {
      dispatcher: direct, signal: AbortSignal.timeout(10_000), redirect: "error",
    });
    if (!response.ok) throw new Error("Unable to discover active outbound network mode");
    const value: unknown = await response.json();
    const data = value && typeof value === "object" && "data" in value ? value.data : null;
    if (!data || typeof data !== "object" || !("proxyEnabled" in data) || data.proxyEnabled !== false) {
      throw new Error("Configure matching REVALIDATION_SECRET in backend and Next before enabling the proxy");
    }
    return { proxyUrl: "", bypassOrigins: [] };
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret).update(`network-config:${timestamp}`).digest("hex");
  const response = await fetch(`${baseUrl}/internal/network`, {
    dispatcher: direct,
    headers: { "x-network-timestamp": timestamp, "x-network-signature": signature },
    signal: AbortSignal.timeout(10_000), redirect: "error",
  });
  if (!response.ok) throw new Error("Unable to authenticate backend network configuration");
  const value: unknown = await response.json();
  const data = value && typeof value === "object" && "data" in value ? value.data : null;
  if (!data || typeof data !== "object" || !("proxyUrl" in data) || typeof data.proxyUrl !== "string"
    || !("bypassOrigins" in data) || !Array.isArray(data.bypassOrigins)
    || !data.bypassOrigins.every((origin: unknown) => typeof origin === "string")) {
    throw new Error("Backend returned invalid network configuration");
  }
  return { proxyUrl: data.proxyUrl, bypassOrigins: data.bypassOrigins };
}
