import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

// 构建/dev 启动前自动提取图标，保持 icon-data.ts 与源码同步
execFileSync("pnpm", ["exec", "tsx", resolve(process.cwd(), "scripts/extract-icons.ts")], {
  stdio: "inherit",
});

const withNextIntl = createNextIntlPlugin("./src/locales/index.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  compress: true,
  // monorepo 中显式指定追踪根，避免 Vercel/Next 误判 lockfile 位置
  outputFileTracingRoot: resolve(__dirname, "../../"),
};

export default withNextIntl(nextConfig);
