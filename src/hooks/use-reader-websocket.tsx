"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useCallback, useEffect, useRef, useState } from "react";

// --- 类型定义 ---
type ReaderMessage
  = | { type: "ping" }
    | { type: "enter_page"; page_type: string; page_id: string; page_title?: string }
    | { type: "leave_page" }
    | { type: "heartbeat" };

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

interface UseReaderWebSocketOptions {
  autoConnect?: boolean;
  heartbeatInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: ServerToReaderMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

// --- 模块级单例 (Module-Level Singleton) ---
// 这种方式保证在 Next.js 客户端路由切换时，连接不会轻易断开
let wsInstance: WebSocket | null = null;
let fingerprintCache: string | null = null;
let activeSubscribers = 0; // 订阅者计数
let disconnectTimeout: NodeJS.Timeout | null = null; // 延迟断开计时器

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useReaderWebSocket(options: UseReaderWebSocketOptions = {}) {
  // 使用 useRef 保持 options 的最新引用，防止 props 变化导致重连
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 状态合并，减少重渲染次数
  const [socketState, setSocketState] = useState({
    isConnected: false,
    onlineCount: 0,
    currentPageReaders: 0,
    ownerStatus: null as OwnerStatus | null,
    readingList: [] as ReadingItem[],
  });

  const [fingerprint, setFingerprint] = useState<string | null>(fingerprintCache);
  const reconnectAttempts = useRef(0);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);

  // --- 核心逻辑 ---

  const sendMessage = useCallback((msg: ReaderMessage) => {
    if (wsInstance?.readyState === WebSocket.OPEN) {
      wsInstance.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = useCallback((data: ServerToReaderMessage) => {
    const opts = optionsRef.current;

    // 触发外部回调
    opts.onMessage?.(data);

    // 批量更新状态
    switch (data.type) {
      case "welcome":
        setSocketState(prev => ({ ...prev, onlineCount: (data as any).online_count }));
        break;
      case "online_count_update":
        setSocketState(prev => ({ ...prev, onlineCount: (data as any).count }));
        break;
      case "owner_window_info":
        setSocketState(prev => ({
          ...prev,
          ownerStatus: {
            ...prev.ownerStatus,
            windowInfo: data.window_info,
            updatedAt: data.updated_at,
          },
        }));
        break;
      case "owner_media_playback":
        setSocketState(prev => ({
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
        setSocketState(prev => ({ ...prev, currentPageReaders: data.count }));
        break;
      case "reading_list":
        setSocketState(prev => ({ ...prev, readingList: data.items }));
        break;
    }
  }, []);

  // 启动心跳
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current)
      clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      sendMessage({ type: "heartbeat" });
    }, optionsRef.current.heartbeatInterval || 30000);
  }, [sendMessage]);

  // 建立连接
  const connect = useCallback(async () => {
    // 如果已有等待断开的定时器，取消它（说明用户在页面间快速跳转）
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
    }

    if (wsInstance?.readyState === WebSocket.OPEN) {
      setSocketState(prev => ({ ...prev, isConnected: true }));
      return;
    }

    if (wsInstance?.readyState === WebSocket.CONNECTING)
      return;

    try {
      // 懒加载 Fingerprint
      if (!fingerprintCache) {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        fingerprintCache = result.visitorId;
        setFingerprint(fingerprintCache);
      }

      const ws = new WebSocket(`${WS_URL}/api/ws/reader`);
      wsInstance = ws;

      ws.onopen = () => {
        console.log("WS Connected");
        reconnectAttempts.current = 0;
        setSocketState(prev => ({ ...prev, isConnected: true }));
        optionsRef.current.onOpen?.();

        // 发送握手（只发送 fingerprint，不带 type 字段）
        if (fingerprintCache) {
          ws.send(JSON.stringify({ fingerprint: fingerprintCache }));
        }
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };

      ws.onclose = () => {
        console.log("WS Closed");
        setSocketState(prev => ({ ...prev, isConnected: false }));
        if (heartbeatTimer.current)
          clearInterval(heartbeatTimer.current);
        optionsRef.current.onClose?.();
        wsInstance = null;

        // 自动重连逻辑
        const { maxReconnectAttempts = 5, reconnectInterval = 3000 } = optionsRef.current;
        if (activeSubscribers > 0 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = (e) => {
        optionsRef.current.onError?.(e);
      };
    } catch (e) {
      console.error("WS Init Error", e);
    }
  }, [handleMessage, startHeartbeat]);

  // 页面进入/离开的快捷方法
  const enterPage = useCallback((pageType: string, pageId: string, pageTitle?: string) => {
    sendMessage({ type: "enter_page", page_type: pageType, page_id: pageId, page_title: pageTitle });
  }, [sendMessage]);

  const leavePage = useCallback(() => {
    sendMessage({ type: "leave_page" });
  }, [sendMessage]);

  // --- 生命周期管理 ---
  useEffect(() => {
    const { autoConnect = true } = optionsRef.current;

    activeSubscribers++;

    if (autoConnect) {
      connect();
    }

    return () => {
      activeSubscribers--;

      // 延迟断开策略：如果 2秒内没有其他组件使用该连接（即 activeSubscribers 为 0），则断开
      // 这解决了 Next.js 路由跳转时导致 WebSocket 频繁断开重连的问题
      if (activeSubscribers === 0) {
        disconnectTimeout = setTimeout(() => {
          if (activeSubscribers === 0 && wsInstance) {
            wsInstance.close();
            wsInstance = null;
          }
        }, 2000);
      }
    };
  }, [connect]);

  return {
    ...socketState, // 展开所有状态 (isConnected, onlineCount, etc.)
    fingerprint,
    connect,
    enterPage,
    leavePage,
    sendMessage,
  };
}
