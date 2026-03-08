import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// 构建/dev 启动前自动提取图标，保持 icon-data.ts 与源码同步
execFileSync("node", [resolve(process.cwd(), "scripts/extract-icons.mjs")], {
  stdio: "inherit",
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  compress: true,
};

export default nextConfig;
