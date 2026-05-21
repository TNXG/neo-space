"use client";

import type { ConnectionStatus } from "@/lib/ws-connection";
import type {
  MediaMetadata,
  NeteaseNowPlaying,
  PlaybackState,
  ReadingItem,
  WindowInfo,
} from "@/stores/ws-store";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useCallback, useEffect, useRef } from "react";
import { WS_BASE_URL, WS_FALLBACK_URL } from "@/lib/api-client";
import { SmartWebSocket } from "@/lib/ws-connection";
import { useWSStore } from "@/stores/ws-store";

// Export types for other components to use
export type { MediaMetadata, NeteaseNowPlaying, PlaybackState, ReadingItem, WindowInfo };
export type { OwnerStatus } from "@/stores/ws-store";

/** Server message to reader */
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
  netease?: NeteaseNowPlaying;
  updated_at?: number;
  message?: string;
}

interface UseReaderWSOptions {
  autoConnect?: boolean;
  pageType?: string;
  pageId?: string;
  pageTitle?: string;
  onMessage?: (message: ServerToReaderMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

// --- WebSocket connection management (module-level singleton) ---
let wsInstance: SmartWebSocket | null = null;
let activeSubscribers = 0;
let disconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let hasSentHello = false;

const HEARTBEAT_INTERVAL_MS = 30_000;

// Cached fingerprint to avoid recomputing
let cachedFingerprint: string | null = null;
let fingerprintPromise: Promise<string> | null = null;

// Use FingerprintJS to generate browser fingerprint
async function getFingerprint(): Promise<string> {
  // If already cached, return directly
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  // If currently computing, return the same Promise
  if (fingerprintPromise) {
    return fingerprintPromise;
  }

  // Start computing fingerprint
  fingerprintPromise = (async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      cachedFingerprint = result.visitorId;
      return cachedFingerprint;
    } catch (error) {
      console.error("Failed to generate fingerprint:", error);
      // Fallback: use localStorage + random number
      const STORAGE_KEY = "reader_fingerprint_fallback";
      if (typeof window !== "undefined") {
        let fallback = localStorage.getItem(STORAGE_KEY);
        if (!fallback) {
          fallback = `fp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          localStorage.setItem(STORAGE_KEY, fallback);
        }
        cachedFingerprint = fallback;
        return fallback;
      }
      // SSR environment fallback
      return `fp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    } finally {
      fingerprintPromise = null;
    }
  })();

  return fingerprintPromise;
}

export function useReaderWS(options: UseReaderWSOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Get state and actions from Zustand store
  const isConnected = useWSStore(state => state.isConnected);
  const onlineCount = useWSStore(state => state.onlineCount);
  const currentPageReaders = useWSStore(state => state.currentPageReaders);
  const ownerStatus = useWSStore(state => state.ownerStatus);
  const readingList = useWSStore(state => state.readingList);

  // Get actions
  const setConnected = useWSStore(state => state.setConnected);
  const setOnlineCount = useWSStore(state => state.setOnlineCount);
  const setCurrentPageReaders = useWSStore(state => state.setCurrentPageReaders);
  const setOwnerWindowInfo = useWSStore(state => state.setOwnerWindowInfo);
  const setOwnerMediaPlayback = useWSStore(state => state.setOwnerMediaPlayback);
  const setReadingList = useWSStore(state => state.setReadingList);

  // Message handler
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
          setOwnerMediaPlayback(data.metadata, data.playback_state, data.netease, data.updated_at);
        }
        break;

      case "error":
        console.error("WS Error:", data.message);
        break;

      case "pong":
        break;
    }
  }, [setOnlineCount, setCurrentPageReaders, setReadingList, setOwnerWindowInfo, setOwnerMediaPlayback]);

  // Connection status handler
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    optionsRef.current.onStatusChange?.(status);

    const isNowConnected = status === "connected_primary" || status === "connected_fallback";
    setConnected(isNowConnected);

    if (isNowConnected && !hasSentHello) {
      // Send Hello message after connection is established
      getFingerprint().then((fingerprint) => {
        if (wsInstance?.send(JSON.stringify({
          type: "hello",
          fingerprint,
        }))) {
          hasSentHello = true;
          optionsRef.current.onOpen?.();
        } else {
          console.error("Failed to send Hello message");
          wsInstance?.disconnect();
        }
      }).catch((e) => {
        console.error("Failed to get fingerprint:", e);
        wsInstance?.disconnect();
      });

      // Start heartbeat
      heartbeatInterval = setInterval(() => {
        wsInstance?.send(JSON.stringify({ type: "ping" }));
      }, HEARTBEAT_INTERVAL_MS);
    } else if (!isNowConnected) {
      // Disconnected
      hasSentHello = false;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (status === "disconnected") {
        optionsRef.current.onClose?.();
      } else if (status === "error") {
        optionsRef.current.onError?.(new Event("WebSocket error"));
      }
    }
  }, [setConnected]);

  const disconnect = useCallback(() => {
    if (wsInstance) {
      wsInstance.disconnect();
      wsInstance = null;
    }
    hasSentHello = false;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    setConnected(false);
  }, [setConnected]);

  const connect = useCallback(() => {
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
    }

    if (wsInstance?.getStatus() === "connected_primary" || wsInstance?.getStatus() === "connected_fallback") {
      queueMicrotask(() => setConnected(true));
      return;
    }

    // Build URL with query parameters
    const params = new URLSearchParams();
    const opts = optionsRef.current;

    if (opts.pageType)
      params.append("pageType", opts.pageType);
    if (opts.pageId)
      params.append("pageId", opts.pageId);
    if (opts.pageTitle)
      params.append("pageTitle", opts.pageTitle);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const primaryUrl = `${WS_BASE_URL}/reader${queryString}`;
    const fallbackUrl = `${WS_FALLBACK_URL}/reader${queryString}`;

    // Create new SmartWebSocket instance
    wsInstance = new SmartWebSocket({
      primaryUrl,
      fallbackUrl,
      onMessage: (data) => {
        try {
          let msg = data;
          if (typeof msg === "string")
            msg = JSON.parse(msg);
          if (typeof msg === "string")
            msg = JSON.parse(msg);
          handleMessage(msg as ServerToReaderMessage);
        } catch (e) {
          console.error("WS Parse Error:", e);
        }
      },
      onStatusChange: handleStatusChange,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
    });

    wsInstance.connect();
  }, [handleMessage, handleStatusChange, setConnected]);

  useEffect(() => {
    const { autoConnect = true } = optionsRef.current;
    activeSubscribers++;

    if (autoConnect && !wsInstance)
      connect();

    return () => {
      activeSubscribers--;
      if (activeSubscribers === 0) {
        disconnectTimeout = setTimeout(() => {
          if (activeSubscribers === 0 && wsInstance) {
            disconnect();
          }
        }, 2000);
      }
    };
  }, [connect, disconnect]);

  useEffect(() => {
    return () => {
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
        disconnectTimeout = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
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
    disconnect,
  };
}
