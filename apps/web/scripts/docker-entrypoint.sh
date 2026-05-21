#!/bin/sh
set -e

# ============================================
# 运行时环境变量注入脚本
# 替换构建时的占位符为实际环境变量值
# ============================================

echo "Injecting runtime environment variables..."

# 查找所有 JS 文件并替换占位符
find /app/.next -type f -name "*.js" -exec sed -i \
  -e "s|__NEXT_PUBLIC_API_URL__|${NEXT_PUBLIC_API_URL:-}|g" \
  -e "s|__NEXT_PUBLIC_TURNSTILE_SITE_KEY__|${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}|g" \
  {} +

echo "Environment variables injected successfully"

# 执行传入的命令
exec "$@"
