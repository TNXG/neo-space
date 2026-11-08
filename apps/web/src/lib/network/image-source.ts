import { parseRemoteImageUrl } from "./image-policy";

export type ImageSourceFetcher = (input: string, init: RequestInit) => Promise<Response>;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/bmp", "image/x-icon", "image/vnd.microsoft.icon", "image/tiff"];

/** Return a non-sensitive API error; never forward upstream error text, cookies, or authorization headers. */
function imageError(code: number, message: string) {
  return Response.json({ code, status: "failed", message, data: null }, { status: code });
}

/** Serve only allowlisted raster images via native fetch, retaining the managed dispatcher and per-hop policy. */
export async function fetchImageSource(source: string, fetchSource: ImageSourceFetcher = fetch): Promise<Response> {
  let url: URL;
  try { url = parseRemoteImageUrl(source); } catch { return imageError(400, "Remote image source is not allowed"); }
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const upstream = await fetchSource(url.href, {
        redirect: "manual", credentials: "omit", cache: "no-store",
        headers: { Accept: "image/*" }, signal: AbortSignal.timeout(15_000),
      });
      if ([301, 302, 303, 307, 308].includes(upstream.status)) {
        await upstream.body?.cancel();
        const location = upstream.headers.get("location");
        if (!location || redirects === 3) return imageError(502, "Image source redirected too many times");
        try { url = parseRemoteImageUrl(new URL(location, url).href); } catch { return imageError(400, "Remote image redirect is not allowed"); }
        continue;
      }
      if (!upstream.ok) {
        await upstream.body?.cancel();
        return imageError(502, "Image source request failed");
      }
      const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
      if (!IMAGE_CONTENT_TYPES.includes(contentType)) {
        await upstream.body?.cancel();
        return imageError(415, "Image source must be a supported raster image");
      }
      if (Number(upstream.headers.get("content-length")) > MAX_IMAGE_BYTES) {
        await upstream.body?.cancel();
        return imageError(413, "Image source exceeds 20 MiB");
      }
      const reader = upstream.body?.getReader();
      if (!reader) return imageError(502, "Image source returned no body");
      let bytes = 0;
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (chunk.done) { controller.close(); return; }
            bytes += chunk.value.byteLength;
            if (bytes > MAX_IMAGE_BYTES) {
              await reader.cancel();
              controller.error(new Error("Image source exceeds 20 MiB"));
              return;
            }
            controller.enqueue(chunk.value);
          } catch {
            controller.error(new Error("Image source stream failed"));
          }
        },
        async cancel() { await reader.cancel(); },
      });
      return new Response(body, { headers: {
        "Content-Type": contentType,
        "Cache-Control": upstream.headers.get("cache-control") || "public, max-age=3600",
        "Content-Disposition": "attachment",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      } });
    }
    return imageError(502, "Image source redirected too many times");
  } catch {
    return imageError(502, "Image source request failed");
  }
}
