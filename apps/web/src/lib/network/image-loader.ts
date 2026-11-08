import type { ImageLoaderProps } from "next/image";
import { parseRemoteImageUrl } from "./image-policy";

/** Keep Next's default resize/cache endpoint, but fetch remote bytes only through the `/api/image-source` route. */
export default function imageLoader({ src, width }: ImageLoaderProps) {
  const source = src.startsWith("/") && !src.startsWith("//")
    ? src
    : `/api/image-source?url=${encodeURIComponent(parseRemoteImageUrl(src).href)}`;
  // Default Next behavior leaves SVGs unoptimized; keep those downloads in the browser.
  if (src.split("?")[0]?.endsWith(".svg")) return src;
  // Next's unchanged default qualities allowlist contains only 75.
  return `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`;
}
