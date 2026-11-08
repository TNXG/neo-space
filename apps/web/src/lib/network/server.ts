import "server-only";

import { Agent, setGlobalDispatcher } from "undici";
import { loadActiveNetworkOptions } from "./configuration";
import { OutboundDispatcher } from "./dispatcher";

const direct = new Agent();

/** Use the deployment's private backend URL when provided, never a browser-visible proxy credential. */
function backendBaseUrl() {
  return (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "https://api-blog.tnxg.top/api").replace(/\/$/, "");
}


/** Install once per Next worker without replacing global fetch or interfering with ISR cache tags. */
export function registerOutboundNetwork() {
  const origins = [backendBaseUrl(), process.env.NEXT_PUBLIC_API_URL, process.env.NEXT_PUBLIC_SITE_URL]
    .filter((value): value is string => Boolean(value))
    .map(value => new URL(value).origin);
  setGlobalDispatcher(new OutboundDispatcher(
    () => loadActiveNetworkOptions(backendBaseUrl(), process.env.REVALIDATION_SECRET, direct),
    origins,
  ));
}
