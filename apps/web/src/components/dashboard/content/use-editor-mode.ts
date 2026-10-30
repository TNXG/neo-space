"use client";

import type { EditorMode } from "./EditorModeSwitch";
import { useEffect, useState } from "react";

const MODE_KEY = "neo-dashboard-editor-mode";

/**
 * 读取并持久化作者偏好的编辑模式，只保存界面偏好。
 * @returns 当前模式与设置函数
 */
export const useEditorMode = () => {
  const [mode, setMode] = useState<EditorMode>("rich");
  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "rich" || saved === "split" || saved === "source") setMode(saved);
  }, []);
  const change = (next: EditorMode) => {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };
  return [mode, change] as const;
};
