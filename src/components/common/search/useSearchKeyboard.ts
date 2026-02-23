import type { SearchItem } from "./types";

import { useCallback, useEffect } from "react";

interface UseSearchKeyboardProps {
  open: boolean;
  allResults: SearchItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  navigateToResult: (item: SearchItem) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * 处理搜索面板的键盘交互
 */
export function useSearchKeyboard({
  open,
  allResults,
  selectedIndex,
  setSelectedIndex,
  navigateToResult,
  onOpenChange,
}: UseSearchKeyboardProps) {
  // 全局快捷键：Cmd/Ctrl+K 打开/关闭，ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // 结果列表内的键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing)
      return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === "Enter" && allResults.length > 0) {
      e.preventDefault();
      const selected = allResults[selectedIndex];
      if (selected) {
        navigateToResult(selected);
      }
    }
  }, [allResults, selectedIndex, setSelectedIndex, navigateToResult]);

  return { handleKeyDown };
}
