import type { TOCItem } from "@/lib/content/toc";
import { create } from "zustand";
import { scrollToAnchor } from "@/lib/content/anchor";

interface TOCState {
  activeId: string;
  items: TOCItem[];
  isInitialized: boolean;
  isAutoScrollEnabled: boolean;
  setActiveId: (id: string) => void;
  setItems: (items: TOCItem[]) => void;
  setAutoScrollEnabled: (enabled: boolean) => void;
  scrollToCenter: (id: string) => boolean;
}

export const useTOCStore = create<TOCState>(set => ({
  activeId: "",
  items: [],
  isInitialized: false,
  isAutoScrollEnabled: true,
  setActiveId: (id: string) => set({ activeId: id }),
  setItems: (items: TOCItem[]) => set({ items, isInitialized: true }),
  setAutoScrollEnabled: (enabled: boolean) => set({ isAutoScrollEnabled: enabled }),
  scrollToCenter: (id: string) => {
    if (!scrollToAnchor(id))
      return false;
    set({ activeId: id });
    return true;
  },
}));
