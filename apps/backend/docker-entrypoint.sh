#!/bin/sh
set -eu

# 命名卷会覆盖镜像内的目录所有者，因此每次启动都先修复持久化缓存权限。
mkdir -p \
  /app/.cache/artworks \
  /app/.cache/cargo \
  /app/.cache/models/bangumi
if ! su-exec appuser:appgroup test -w /app/.cache \
  || ! su-exec appuser:appgroup test -w /app/.cache/artworks \
  || ! su-exec appuser:appgroup test -w /app/.cache/cargo \
  || ! su-exec appuser:appgroup test -w /app/.cache/models/bangumi; then
  chown -R appuser:appgroup /app/.cache
fi

# 权限修复完成后立即降权，后端进程不以 root 身份运行。
exec su-exec appuser:appgroup "$@"
