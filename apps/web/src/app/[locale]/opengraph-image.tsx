/* eslint-disable react-refresh/only-export-components */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SiteOpenGraphImage } from "@/components/seo/SiteOpenGraphImage";
import { getSiteConfig } from "@/lib/api-client";
import { loadOgFonts } from "@/lib/og-font";

export const alt = "Neo-Space";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Generate the public site's OG image from SEO settings and local branding.
 * @returns A 1200 × 630 PNG; unavailable settings keep the same visual template.
 */
export default async function Image() {
  let title = "Neo-Space";
  let description = "";

  try {
    const configResponse = await getSiteConfig();
    title = configResponse.data?.seo.title.trim() || title;
    description = configResponse.data?.seo.description.trim() || "";
  } catch {
    // Preserve the existing site-name fallback when the config API is unavailable.
  }

  const icon = await readFile(join(process.cwd(), "public/favicon_256.png"));
  const hostname = new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe",
  ).hostname;
  const fonts = await loadOgFonts([title, description, hostname]);

  return new ImageResponse(
    (
      <SiteOpenGraphImage
        title={title}
        description={description}
        hostname={hostname}
        icon={`data:image/png;base64,${icon.toString("base64")}`}
      />
    ),
    { ...size, fonts },
  );
}
