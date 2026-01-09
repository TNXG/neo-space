"use client";

import type { OwnerStatus as OwnerStatusType } from "@/hooks/use-reader-sse";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

interface OwnerStatusProps {
  ownerStatus: OwnerStatusType | null;
  isConnected: boolean;
}

/**
 * 博主状态组件
 * 显示博主当前活动和正在播放的媒体
 */
export function OwnerStatus({ ownerStatus, isConnected }: OwnerStatusProps) {
  const [localOffset, setLocalOffset] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevServerTimeRef = useRef<number>(0);
  const STALE_MS = 90_000;
  const [now, setNow] = useState(() => Date.now());

  const mediaPlayback = ownerStatus?.mediaPlayback;
  const windowInfo = ownerStatus?.windowInfo;
  const playbackState = mediaPlayback?.playbackState;
  const serverElapsedTime = playbackState?.elapsed_time ?? 0;
  const playbackRate = playbackState?.playback_rate ?? 1;
  const isPlaying = playbackState?.playing ?? false;
  const duration = mediaPlayback?.metadata.duration ?? 0;
  const updatedAt = ownerStatus?.updatedAt ?? 0;

  // 计算实际播放时间
  const elapsedTime = useMemo(() => {
    return serverElapsedTime + localOffset;
  }, [serverElapsedTime, localOffset]);

  const progress = duration > 0 ? Math.min((elapsedTime / duration) * 100, 100) : 0;

  // 判断博主是否在线/状态是否新鲜
  const isFresh = updatedAt > 0 && now - updatedAt < STALE_MS;
  const hasAnyData = !!(mediaPlayback?.metadata?.title || windowInfo?.title);
  const isOwnerOnline = isConnected && isFresh;

  // 重置本地偏移当服务器时间更新时
  if (serverElapsedTime !== prevServerTimeRef.current) {
    prevServerTimeRef.current = serverElapsedTime;
    if (localOffset !== 0) {
      setLocalOffset(0);
    }
  }

  // 实时更新播放进度
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setLocalOffset(prev => prev + playbackRate);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackRate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatRelative = (ts: number) => {
    if (!ts)
      return "";
    const diff = Math.max(0, now - ts);
    const s = Math.floor(diff / 1000);
    if (s < 10)
      return "刚刚";
    if (s < 60)
      return `${s} 秒前`;
    const m = Math.floor(s / 60);
    if (m < 60)
      return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24)
      return `${h} 小时前`;
    const d = Math.floor(h / 24);
    if (d > 7)
      return ""; // 超过7天不显示相对时间
    return `${d} 天前`;
  };

  // 获取活动描述
  const getActivityText = () => {
    if (isPlaying && mediaPlayback?.metadata.title) {
      return mediaPlayback.metadata.artist
        ? `正在听 · ${mediaPlayback.metadata.title} · ${mediaPlayback.metadata.artist}`
        : `正在听 · ${mediaPlayback.metadata.title}`;
    }
    if (windowInfo?.title) {
      return `正在使用 · ${windowInfo.process_name}`;
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
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3">
                {/* 顶部状态行 */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOwnerOnline ? "animate-ping bg-accent-500" : isConnected ? "bg-amber-400/60" : "bg-neutral-400/60"}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isOwnerOnline ? "bg-accent-500" : isConnected ? "bg-amber-500" : "bg-neutral-400"}`} />
                    </span>
                    <span>{getActivityText()}</span>
                  </div>
                  {updatedAt > 0 && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {isFresh ? "刚刚更新" : `最近更新 ${formatRelative(updatedAt)}`}
                    </span>
                  )}
                </div>

                {/* 加载/无数据占位（仅连接但暂无线索时） */}
                {isConnected && !hasAnyData && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="animate-pulse h-3 w-3 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground">正在连接数据…</span>
                  </div>
                )}

                {/* 媒体播放卡片 */}
                {mediaPlayback?.metadata.title && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50"
                  >
                    {/* 封面 */}
                    <div className="relative shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden bg-secondary">
                      {mediaPlayback.metadata.artwork_url
                        ? (
                            <img
                              src={mediaPlayback.metadata.artwork_url}
                              alt={mediaPlayback.metadata.album || "Album Art"}
                              className="w-full h-full object-cover"
                            />
                          )
                        : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Icon icon="mingcute:music-2-line" className="text-xl" />
                            </div>
                          )}
                      {/* 播放状态指示 */}
                      {isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="flex gap-0.5 items-end h-3">
                            <span className="w-0.5 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: "60%", animationDelay: "0ms" }} />
                            <span className="w-0.5 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: "100%", animationDelay: "150ms" }} />
                            <span className="w-0.5 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: "40%", animationDelay: "300ms" }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-sm font-medium text-foreground truncate">
                        {mediaPlayback.metadata.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {mediaPlayback.metadata.artist}
                        {mediaPlayback.metadata.album && ` · ${mediaPlayback.metadata.album}`}
                      </p>

                      {/* 进度条 */}
                      {duration > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-accent-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.5, ease: "linear" }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {formatTime(elapsedTime)}
                            {" / "}
                            {formatTime(duration)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 窗口信息 */}
                {windowInfo?.title && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/30"
                  >
                    {windowInfo.icon_url
                      ? (
                          <img
                            src={windowInfo.icon_url}
                            alt={windowInfo.process_name}
                            className="w-4 h-4 rounded"
                          />
                        )
                      : (
                          <Icon icon="mingcute:window-line" className="text-muted-foreground" />
                        )}
                    <span className="text-xs text-muted-foreground truncate">
                      {windowInfo.title}
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        : null}
    </AnimatePresence>
  );
}
