"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SSE_BASE_URL } from "@/lib/api-client";

// --- 类型定义 ---
/** 窗口信息 */
export interface WindowInfo {
  title: string;
  process_name: string;
  icon_url?: string;
  app_id?: string;
  pid: number;
}

/** 媒体元数据 */
export interface MediaMetadata {
  bundle_identifier?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration: number;
  artwork_url?: string;
  content_item_identifier?: string;
}

/** 播放状态 */
export interface PlaybackState {
  playing: boolean;
  playback_rate: number;
  elapsed_time: number;
}

/** 博主状态 */
export interface OwnerStatus {
  windowInfo?: WindowInfo;
  mediaPlayback?: {
    metadata: MediaMetadata;
    playbackState: PlaybackState;
  };
  updatedAt: number;
}

type ServerToReaderMessage
  = | { type: "pong" }
    | { type: "welcome"; online_count: number }
    | { type: "online_count_update"; count: number }
    | { type: "page_readers"; page_type: string; page_id: string; count: number }
    | { type: "reading_list"; items: ReadingItem[] }
    | { type: "owner_window_info"; window_info: WindowInfo; updated_at: number }
    | { type: "owner_media_playback"; metadata: MediaMetadata; playback_state: PlaybackState; updated_at: number }
    | { type: "error"; message: string };

export interface ReadingItem {
  page_type: string;
  page_id: string;
  page_title?: string;
  reader_count: number;
}

interface UseReaderSSEOptions {
  autoConnect?: boolean;
  pageType?: string;
  pageId?: string;
  pageTitle?: string;
  onMessage?: (message: ServerToReaderMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

// --- 模块级单例 ---
let sseInstance: EventSource | null = null;
let activeSubscribers = 0;
let disconnectTimeout: NodeJS.Timeout | null = null;

export function useReaderSSE(options: UseReaderSSEOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [sseState, setSSEState] = useState({
    isConnected: false,
    onlineCount: 0,
    currentPageReaders: 0,
    ownerStatus: null as OwnerStatus | null,
    readingList: [] as ReadingItem[],
  });

  // 状态更新函数
  const updateConnectionState = useCallback((isConnected: boolean) => {
    setSSEState(prev => ({ ...prev, isConnected }));
  }, []);

  const handleMessage = useCallback((data: ServerToReaderMessage) => {
    const opts = optionsRef.current;
    opts.onMessage?.(data);

    switch (data.type) {
      case "welcome":
        setSSEState(prev => ({ ...prev, onlineCount: (data as any).online_count }));
        break;
      case "online_count_update":
        setSSEState(prev => ({ ...prev, onlineCount: (data as any).count }));
        break;
      case "owner_window_info":
        setSSEState(prev => ({
          ...prev,
          ownerStatus: {
            ...prev.ownerStatus,
            windowInfo: data.window_info,
            updatedAt: data.updated_at,
          },
        }));
        break;
      case "owner_media_playback":
        setSSEState(prev => ({
          ...prev,
          ownerStatus: {
            ...prev.ownerStatus,
            mediaPlayback: {
              metadata: data.metadata,
              playbackState: data.playback_state,
            },
            updatedAt: data.updated_at,
          },
        }));
        break;
      case "page_readers":
        setSSEState(prev => ({ ...prev, currentPageReaders: data.count }));
        break;
      case "reading_list":
        setSSEState(prev => ({ ...prev, readingList: data.items }));
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
    }

    if (sseInstance?.readyState === EventSource.OPEN) {
      queueMicrotask(() => {
        updateConnectionState(true);
      });
      return;
    }

    if (sseInstance?.readyState === EventSource.CONNECTING)
      return;

    try {
      // 构建 URL，包含页面信息
      const params = new URLSearchParams();
      const opts = optionsRef.current;

      if (opts.pageType)
        params.append("page_type", opts.pageType);
      if (opts.pageId)
        params.append("page_id", opts.pageId);
      if (opts.pageTitle)
        params.append("page_title", opts.pageTitle);

      const url = `${SSE_BASE_URL}/reader${params.toString() ? `?${params.toString()}` : ""}`;
      const sse = new EventSource(url);
      sseInstance = sse;

      sse.onopen = () => {
        console.log("SSE Connected");
        updateConnectionState(true);
        optionsRef.current.onOpen?.();
      };

      sse.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error("SSE Parse Error", e);
        }
      };

      sse.onerror = (e) => {
        console.log("SSE Error or Closed");
        updateConnectionState(false);
        optionsRef.current.onError?.(e);
        optionsRef.current.onClose?.();

        // EventSource 会自动重连，除非我们手动关闭
        // 如果没有订阅者，关闭连接
        if (activeSubscribers === 0) {
          sse.close();
          sseInstance = null;
        }
      };
    } catch (e) {
      console.error("SSE Init Error", e);
    }
  }, [handleMessage, updateConnectionState]);

  useEffect(() => {
    const { autoConnect = true } = optionsRef.current;

    activeSubscribers++;

    if (autoConnect) {
      connect();
    }

    return () => {
      activeSubscribers--;

      if (activeSubscribers === 0) {
        disconnectTimeout = setTimeout(() => {
          if (activeSubscribers === 0 && sseInstance) {
            sseInstance.close();
            sseInstance = null;
          }
        }, 2000);
      }
    };
  }, [connect]);

  // 组件卸载时清理 disconnectTimeout
  useEffect(() => {
    return () => {
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
        disconnectTimeout = null;
      }
    };
  }, []);

  return {
    ...sseState,
    connect,
  };
}
