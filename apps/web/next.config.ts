import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

// 构建/dev 启动前自动提取图标，保持 icon-data.ts 与源码同步
execFileSync(
  "pnpm",
  ["exec", "tsx", resolve(process.cwd(), "scripts/extract-icons.ts")],
  {
    stdio: "inherit",
  },
);

const withNextIntl = createNextIntlPlugin("./src/locales/index.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
  compress: true,
  outputFileTracingRoot: resolve(__dirname, "../../"),
  allowedDevOrigins: ["192.168.3.3"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lain.bgm.tv",
      },
    ],
  },
  experimental: {
    useTypeScriptCli: true,
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/service-worker.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
