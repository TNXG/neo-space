/* eslint-disable react-refresh/only-export-components */
import { ImageResponse } from "next/og";
import { getSiteConfig } from "@/lib/api-client";

export const runtime = "edge";
export const alt = "Neo-Space";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  try {
    const configResponse = await getSiteConfig();
    const { seo } = configResponse.data;

    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 64,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 80, fontWeight: "bold", marginBottom: 20 }}>
            {seo.title}
          </div>
          <div style={{ fontSize: 40, opacity: 0.9 }}>
            {seo.description}
          </div>
        </div>
      ),
      {
        ...size,
      },
    );
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 64,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          Neo-Space
        </div>
      ),
      {
        ...size,
      },
    );
  }
}
