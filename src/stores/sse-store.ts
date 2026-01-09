import { create } from "zustand";

// --- 类型定义（与后端完全对齐）---

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

/** 正在阅读的内容项 */
export interface ReadingItem {
  page_type: string;
  page_id: string;
  page_title?: string;
  reader_count: number;
}

/** 博主状态（前端聚合） */
export interface OwnerStatus {
  windowInfo?: WindowInfo;
  mediaPlayback?: {
    metadata: MediaMetadata;
    playbackState: PlaybackState;
  };
  updatedAt: number;
}

/** SSE 状态 */
interface SSEState {
  isConnected: boolean;
  onlineCount: number;
  currentPageReaders: number;
  ownerStatus: OwnerStatus | null;
  readingList: ReadingItem[];
}

/** SSE Actions */
interface SSEActions {
  setConnected: (connected: boolean) => void;
  setOnlineCount: (count: number) => void;
  setCurrentPageReaders: (count: number) => void;
  setOwnerWindowInfo: (windowInfo: WindowInfo, updatedAt: number) => void;
  setOwnerMediaPlayback: (
    metadata: MediaMetadata,
    playbackState: PlaybackState,
    updatedAt: number,
  ) => void;
  setReadingList: (items: ReadingItem[]) => void;
  reset: () => void;
}

const initialState: SSEState = {
  isConnected: false,
  onlineCount: 0,
  currentPageReaders: 0,
  ownerStatus: null,
  readingList: [],
};

export const useSSEStore = create<SSEState & SSEActions>(set => ({
  ...initialState,

  setConnected: connected => set({ isConnected: connected }),

  setOnlineCount: count => set({ onlineCount: count }),

  setCurrentPageReaders: count => set({ currentPageReaders: count }),

  setOwnerWindowInfo: (windowInfo, updatedAt) =>
    set(state => ({
      ownerStatus: {
        windowInfo,
        mediaPlayback: state.ownerStatus?.mediaPlayback,
        updatedAt,
      },
    })),

  setOwnerMediaPlayback: (metadata, playbackState, updatedAt) =>
    set(state => ({
      ownerStatus: {
        windowInfo: state.ownerStatus?.windowInfo,
        mediaPlayback: { metadata, playbackState },
        updatedAt,
      },
    })),

  setReadingList: items => set({ readingList: items }),

  reset: () => set(initialState),
}));
