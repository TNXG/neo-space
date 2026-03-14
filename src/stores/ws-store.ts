import { create } from "zustand";

// --- Type definitions (aligned with backend) ---

/** Window information */
export interface WindowInfo {
  title: string;
  process_name: string;
  icon_url?: string;
  app_id?: string;
  pid: number;
}

/** Media metadata */
export interface MediaMetadata {
  bundle_identifier?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration: number;
  artwork_url?: string;
  content_item_identifier?: string;
}

/** Playback state */
export interface PlaybackState {
  playing: boolean;
  playback_rate: number;
  elapsed_time: number;
}

/** Reading content item */
export interface ReadingItem {
  page_type: string;
  page_id: string;
  page_title?: string;
  reader_count: number;
}

/** Owner status (frontend aggregated) */
export interface OwnerStatus {
  windowInfo?: WindowInfo;
  mediaPlayback?: {
    metadata: MediaMetadata;
    playbackState: PlaybackState;
  };
  updatedAt: number;
}

/** WebSocket state */
interface WSState {
  isConnected: boolean;
  onlineCount: number;
  currentPageReaders: number;
  ownerStatus: OwnerStatus | null;
  readingList: ReadingItem[];
}

/** WebSocket Actions */
interface WSActions {
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

const initialState: WSState = {
  isConnected: false,
  onlineCount: 0,
  currentPageReaders: 0,
  ownerStatus: null,
  readingList: [],
};

export const useWSStore = create<WSState & WSActions>(set => ({
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
