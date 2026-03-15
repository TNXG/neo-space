"use client";

import type { OwnerStatus as OwnerStatusType } from "@/hooks/use-reader-ws";
import { AnimatePresence, motion } from "motion/react";

interface OwnerStatusProps {
  ownerStatus: OwnerStatusType | null;
  isConnected: boolean;
  className?: string;
}

export function OwnerStatus({ ownerStatus, isConnected, className }: OwnerStatusProps) {
  const mediaPlayback = ownerStatus?.mediaPlayback;
  const windowInfo = ownerStatus?.windowInfo;
  const netease = ownerStatus?.netease;
  const isPlaying = mediaPlayback?.playbackState?.playing ?? false;

  // 通过 ws 中是否有 media 或 window 信息来判断博主在线
  const hasActivity = Boolean(mediaPlayback || windowInfo || netease?.active);
  const isOwnerOnline = isConnected && hasActivity;

  const getActivityText = () => {
    if (isPlaying && mediaPlayback?.metadata.title) {
      return mediaPlayback.metadata.artist
        ? `正在听 ${mediaPlayback.metadata.title} - ${mediaPlayback.metadata.artist}`
        : `正在听 ${mediaPlayback.metadata.title}`;
    }
    if (netease?.active && netease.song) {
      return `正在听 ${netease.song.name} - ${netease.song.artist}`;
    }
    if (windowInfo?.title) {
      return `正在使用 ${windowInfo.process_name}`;
    }
    if (isConnected && !hasActivity)
      return "在线 · 暂无活动";
    return isConnected ? "在线" : "离线";
  };

  return (
    <AnimatePresence mode="wait">
      {(isConnected || hasActivity)
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
