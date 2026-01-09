"use client";

import type {
  MediaMetadata,
  PlaybackState,
  ReadingItem,
  WindowInfo,
} from "@/stores/sse-store";
import { useCallback, useEffect, useRef } from "react";
import { SSE_BASE_URL } from "@/lib/api-client";
import { useSSEStore } from "@/stores/sse-store";

// 导出类型供其他组件使用
export type { MediaMetadata, PlaybackState, ReadingItem, WindowInfo };
export type { OwnerStatus } from "@/stores/sse-store";

/** 服务器发送给读者的消息 */
interface ServerToReaderMessage {
  type: string;
  online_count?: number;
  count?: number;
  page_type?: string;
  page_id?: string;
  items?: ReadingItem[];
  window_info?: WindowInfo;
  metadata?: MediaMetadata;
  playback_state?: PlaybackState;
  updated_at?: number;
  message?: string;
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

// --- SSE 连接管理（模块级单例）---
let sseInstance: EventSource | null = null;
let activeSubscribers = 0;
let disconnectTimeout: NodeJS.Timeout | null = null;

export function useReaderSSE(options: UseReaderSSEOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 从 Zustand store 获取状态和 actions
  const isConnected = useSSEStore(state => state.isConnected);
  const onlineCount = useSSEStore(state => state.onlineCount);
  const currentPageReaders = useSSEStore(state => state.currentPageReaders);
  const ownerStatus = useSSEStore(state => state.ownerStatus);
  const readingList = useSSEStore(state => state.readingList);

  // 获取 actions
  const setConnected = useSSEStore(state => state.setConnected);
  const setOnlineCount = useSSEStore(state => state.setOnlineCount);
  const setCurrentPageReaders = useSSEStore(state => state.setCurrentPageReaders);
  const setOwnerWindowInfo = useSSEStore(state => state.setOwnerWindowInfo);
  const setOwnerMediaPlayback = useSSEStore(state => state.setOwnerMediaPlayback);
  const setReadingList = useSSEStore(state => state.setReadingList);

  // 消息处理函数
  const handleMessage = useCallback((data: ServerToReaderMessage) => {
    const opts = optionsRef.current;
    opts.onMessage?.(data);

    switch (data.type) {
      case "welcome":
        if (data.online_count !== undefined)
          setOnlineCount(data.online_count);
        break;

      case "online_count_update":
        if (data.count !== undefined)
          setOnlineCount(data.count);
        break;

      case "page_readers":
        if (data.count !== undefined)
          setCurrentPageReaders(data.count);
        break;

      case "reading_list":
        if (data.items)
          setReadingList(data.items);
        break;

      case "owner_window_info":
        if (data.window_info && data.updated_at !== undefined) {
          setOwnerWindowInfo(data.window_info, data.updated_at);
        }
        break;

      case "owner_media_playback":
        if (data.metadata && data.playback_state && data.updated_at !== undefined) {
          setOwnerMediaPlayback(data.metadata, data.playback_state, data.updated_at);
        }
        break;

      case "error":
        console.error("SSE Error:", data.message);
        break;

      case "pong":
        break;
    }
  }, [setOnlineCount, setCurrentPageReaders, setReadingList, setOwnerWindowInfo, setOwnerMediaPlayback]);

  const connect = useCallback(() => {
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
    }

    if (sseInstance?.readyState === EventSource.OPEN) {
      queueMicrotask(() => setConnected(true));
      return;
    }

    if (sseInstance?.readyState === EventSource.CONNECTING)
      return;

    try {
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
        setConnected(true);
        optionsRef.current.onOpen?.();
      };

      sse.onmessage = (event) => {
        try {
          let msg = event.data;
          if (typeof msg === "string")
            msg = JSON.parse(msg);
          if (typeof msg === "string")
            msg = JSON.parse(msg);
          handleMessage(msg as ServerToReaderMessage);
        } catch (e) {
          console.error("SSE Parse Error:", e);
        }
      };

      sse.onerror = (e) => {
        setConnected(false);
        optionsRef.current.onError?.(e);

        if (activeSubscribers === 0) {
          sse.close();
          sseInstance = null;
          optionsRef.current.onClose?.();
        }
      };
    } catch (e) {
      console.error("SSE Init Error:", e);
    }
  }, [handleMessage, setConnected]);

  useEffect(() => {
    const { autoConnect = true } = optionsRef.current;
    activeSubscribers++;

    if (autoConnect)
      connect();

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

  useEffect(() => {
    return () => {
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
        disconnectTimeout = null;
      }
    };
  }, []);

  return {
    isConnected,
    onlineCount,
    currentPageReaders,
    ownerStatus,
    readingList,
    connect,
  };
}
