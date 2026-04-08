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
};

export default withNextIntl(nextConfig);
