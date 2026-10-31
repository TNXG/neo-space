/* eslint-disable @next/next/no-img-element -- ImageResponse renders embedded images, not browser image elements. */
import { OG_FONT_FAMILY } from "@/lib/og-font";

interface SiteOpenGraphImageProps {
  title: string;
  description: string;
  hostname: string;
  icon: string;
}

// ImageResponse has no CSS cascade: resolve the light-theme semantic tokens
// from app/globals.css here. Social crawlers do not carry a reader's theme.
const palette = {
  background: "#f5f5f4", // --background / --primary-100
  foreground: "#1c1917", // --foreground / --primary-900
  mutedForeground: "#57534e", // --muted-foreground / --primary-600
  border: "#e7e5e4", // --border / --primary-200
  primary: "#0d9488", // --primary / --accent-600
};

/**
 * Render the site's sharing image as a quiet, left-aligned title page.
 * @param props SEO copy, canonical hostname and an embedded site icon.
 * @returns A fixed-size Satori-compatible layout with bounded text regions.
 */
export function SiteOpenGraphImage({ title, description, hostname, icon }: SiteOpenGraphImageProps) {
  return (
    <div
      lang="zh-CN"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "64px 80px 48px",
        background: palette.background,
        color: palette.foreground,
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", height: 64, flexShrink: 0 }}>
        <img src={icon} alt="" width={64} height={64} style={{ borderRadius: 32 }} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          flexGrow: 1,
          minHeight: 0,
          paddingTop: 64,
        }}
      >
        <div
          style={{
            display: "block",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "-0.025em",
            lineClamp: 2,
            wordBreak: "break-word",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              display: "block",
              marginTop: 24,
              maxWidth: 920,
              fontSize: 28,
              lineHeight: 1.6,
              color: palette.mutedForeground,
              lineClamp: 2,
              wordBreak: "break-word",
              overflow: "hidden",
            }}
          >
            {description}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderTop: `1px solid ${palette.border}`,
          paddingTop: 24,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 24, height: 3, background: palette.primary, marginRight: 16 }} />
        <div
          style={{
            display: "block",
            maxWidth: 960,
            fontSize: 22,
            lineHeight: 1.6,
            letterSpacing: "0.025em",
            color: palette.mutedForeground,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {hostname}
        </div>
      </div>
    </div>
  );
}
