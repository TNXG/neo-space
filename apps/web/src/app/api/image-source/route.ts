import { fetchImageSource } from "@/lib/network/image-source";

export const runtime = "nodejs";

/** GET /api/image-source?url=… — public raster image bytes, not an authenticated API forwarding endpoint. */
export async function GET(request: Request) {
  return fetchImageSource(new URL(request.url).searchParams.get("url") || "");
}
