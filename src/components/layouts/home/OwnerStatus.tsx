"use client";

import type { OwnerStatus as OwnerStatusType } from "@/hooks/use-reader-sse";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

interface OwnerStatusProps {
  ownerStatus: OwnerStatusType | null;
  isConnected: boolean;
  className?: string;
}

/**
 * 博主状态组件
 * 显示博主当前活动和正在播放的媒体
 */
export function OwnerStatus({ ownerStatus, isConnected, className }: OwnerStatusProps) {
  const STALE_MS = 90_000;
  const [now, setNow] = useState(() => Date.now());

  const mediaPlayback = ownerStatus?.mediaPlayback;
  const windowInfo = ownerStatus?.windowInfo;
  const playbackState = mediaPlayback?.playbackState;
  const isPlaying = playbackState?.playing ?? false;
  const updatedAt = ownerStatus?.updatedAt ?? 0;

  // 判断博主是否在线/状态是否新鲜
  const isFresh = updatedAt > 0 && now - updatedAt < STALE_MS;
  const isOwnerOnline = isConnected && isFresh;

  // 获取活动描述
  const getActivityText = () => {
    if (isPlaying && mediaPlayback?.metadata.title) {
      return mediaPlayback.metadata.artist
        ? `正在听 ${mediaPlayback.metadata.title} - ${mediaPlayback.metadata.artist}`
        : `正在听 ${mediaPlayback.metadata.title}`;
    }
    if (windowInfo?.title) {
      return `正在使用 ${windowInfo.process_name}`;
    }
    if (isConnected && !isFresh)
      return "在线 · 暂无活动";
    return isConnected ? "在线" : "离线";
  };

  // 定时刷新相对时间与“新鲜度”判定
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {(isConnected || updatedAt > 0)
        ? (
            <motion.div
              key="owner-status"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`overflow-hidden flex items-center ${className}`}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOwnerOnline ? "animate-ping bg-accent-500" : isConnected ? "bg-amber-400/60" : "bg-neutral-400/60"}`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isOwnerOnline ? "bg-accent-500" : isConnected ? "bg-amber-500" : "bg-neutral-400"}`} />
                </span>
                <span className="truncate max-w-37.5 md:max-w-75">{getActivityText()}</span>
              </div>
            </motion.div>
          )
        : null}
    </AnimatePresence>
  );
}
