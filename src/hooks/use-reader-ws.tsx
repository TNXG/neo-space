"use client";

import type {
  MediaMetadata,
  PlaybackState,
  ReadingItem,
  WindowInfo,
} from "@/stores/ws-store";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useCallback, useEffect, useRef } from "react";
import { WS_BASE_URL } from "@/lib/api-client";
import { useWSStore } from "@/stores/ws-store";

// Export types for other components to use
export type { MediaMetadata, PlaybackState, ReadingItem, WindowInfo };
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
}

// --- WebSocket connection management (module-level singleton) ---
let wsInstance: WebSocket | null = null;
let activeSubscribers = 0;
let disconnectTimeout: NodeJS.Timeout | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

// Cached fingerprint to avoid recomputing
let cachedFingerprint: string | null = null;
let fingerprintPromise: Promise<string> | null = null;

// Reconnection configuration
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
let reconnectAttempts = 0;

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
          setOwnerMediaPlayback(data.metadata, data.playback_state, data.updated_at);
        }
        break;

      case "error":
        console.error("WS Error:", data.message);
        break;

      case "pong":
        break;
    }
  }, [setOnlineCount, setCurrentPageReaders, setReadingList, setOwnerWindowInfo, setOwnerMediaPlayback]);

  const disconnect = useCallback(() => {
    if (wsInstance) {
      wsInstance.close();
      wsInstance = null;
    }
    setConnected(false);
  }, [setConnected]);

  const connect = useCallback(async () => {
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (wsInstance?.readyState === WebSocket.OPEN) {
      queueMicrotask(() => setConnected(true));
      return;
    }

    if (wsInstance?.readyState === WebSocket.CONNECTING)
      return;

    try {
      const params = new URLSearchParams();
      const opts = optionsRef.current;

      if (opts.pageType)
        params.append("pageType", opts.pageType);
      if (opts.pageId)
        params.append("pageId", opts.pageId);
      if (opts.pageTitle)
        params.append("pageTitle", opts.pageTitle);

      const url = `${WS_BASE_URL}/reader${params.toString() ? `?${params.toString()}` : ""}`;
      const ws = new WebSocket(url);
      wsInstance = ws;

      ws.onopen = async () => {
        // Send Hello message with fingerprint after connection is established
        try {
          const fingerprint = await getFingerprint();
          const helloMsg = JSON.stringify({
            type: "hello",
            fingerprint,
          });
          ws.send(helloMsg);
        } catch (e) {
          console.error("Failed to send Hello message:", e);
          ws.close();
          return;
        }

        setConnected(true);
        reconnectAttempts = 0; // Reset retry counter on successful connection
        optionsRef.current.onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          let msg = event.data;
          if (typeof msg === "string")
            msg = JSON.parse(msg);
          if (typeof msg === "string")
            msg = JSON.parse(msg);
          handleMessage(msg as ServerToReaderMessage);
        } catch (e) {
          console.error("WS Parse Error:", e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        optionsRef.current.onClose?.();

        // Auto-reconnect with exponential backoff
        if (activeSubscribers > 0 && reconnectAttempts < MAX_RETRIES) {
          const delay = BASE_DELAY * 2 ** reconnectAttempts;
          reconnectAttempts++;
          console.log(`WS disconnected, reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RETRIES})`);
          reconnectTimeout = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (e) => {
        setConnected(false);
        optionsRef.current.onError?.(e);

        if (activeSubscribers === 0) {
          ws.close();
          wsInstance = null;
        }
      };
    } catch (e) {
      console.error("WS Init Error:", e);
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
          if (activeSubscribers === 0 && wsInstance) {
            wsInstance.close();
            wsInstance = null;
            setConnected(false);
          }
        }, 2000);
      }
    };
  }, [connect, setConnected]);

  useEffect(() => {
    return () => {
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
        disconnectTimeout = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
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
