"use client";

import type { EditorView } from "@milkdown/kit/prose/view";
import { TextSelection } from "@milkdown/kit/prose/state";

export interface SlashState {
  query: string;
  /** 光标视口坐标，用于定位菜单。 */
  rect: { left: number; top: number; bottom: number };
}

/**
 * 当光标所在段落以「/」开头且其后无空白时触发斜杠菜单，与 Notion 习惯一致。
 * @param view 编辑器视图
 * @returns 斜杠状态，未触发返回 undefined
 */
export const readSlashState = (view: EditorView | undefined): SlashState | undefined => {
  if (!view || !view.hasFocus()) return undefined;
  const { selection } = view.state;
  if (!selection.empty) return undefined;
  const { $from } = selection;
  if ($from.parent.type.name !== "paragraph") return undefined;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\uFFFC");
  const match = /^\/([^\s/]{0,24})$/.exec(text);
  if (!match) return undefined;
  const coords = view.coordsAtPos($from.pos);
  return { query: match[1], rect: { left: coords.left, top: coords.top, bottom: coords.bottom } };
};

/**
 * 计算选区的视口矩形，浮动工具栏据此居中定位。
 * @param view 编辑器视图
 * @returns 选区范围；空选区或失焦返回 undefined
 */
export const readSelectionRect = (view: EditorView | undefined) => {
  if (!view || !view.hasFocus()) return undefined;
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || selection.empty) return undefined;
  if (!view.state.doc.textBetween(selection.from, selection.to).trim()) return undefined;
  const start = view.coordsAtPos(selection.from);
  const end = view.coordsAtPos(selection.to, -1);
  return {
    left: Math.min(start.left, end.left),
    right: Math.max(start.right, end.right),
    top: Math.min(start.top, end.top),
    bottom: Math.max(start.bottom, end.bottom),
  };
};
