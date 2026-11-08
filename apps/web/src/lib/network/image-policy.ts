/** The existing Next remotePatterns allowlist, now enforced at the managed image-source boundary. */
export const REMOTE_IMAGE_PATTERNS = [
  { protocol: "https:", hostname: "lain.bgm.tv", port: "" },
  { protocol: "https:", hostname: "api-space.tnxg.top", port: "" },
  { protocol: "https:", hostname: "cdn.tnxg.top", port: "" },
] as const;

/** Restrict every initial URL and redirect hop to the site's existing public HTTPS image origins. */
export function parseRemoteImageUrl(value: string) {
  const url = new URL(value);
  if (value.length > 2048 || url.username || url.password || url.hash
    || !REMOTE_IMAGE_PATTERNS.some(pattern => url.protocol === pattern.protocol && url.hostname === pattern.hostname && url.port === pattern.port)) {
    throw new Error("Remote image source is not allowed");
  }
  return url;
}
