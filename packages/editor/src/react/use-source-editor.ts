"use client";

import type { EditorView } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";
import { languages } from "@codemirror/language-data";
import { useEffect, useRef, useState } from "react";
import { createSourceEditor } from "../core/create-source";

export interface UseSourceOptions {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * 管理 CodeMirror 源码编辑器；外部值变化时以单次事务替换，保留撤销历史。
 * @param options 编辑器参数
 * @returns 挂载 ref 与视图
 */
export function useSourceEditor(options: UseSourceOptions) {
  const [parent, setParent] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState<EditorView>();
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    if (!parent) return;
    const created = createSourceEditor({
      parent,
      value: latest.current.value,
      languages,
      placeholder: latest.current.placeholder,
      onChange: value => latest.current.onChange(value),
    });
    setView(created);
    return () => {
      created.destroy();
      setView(undefined);
    };
  }, [parent]);

  useEffect(() => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== options.value) view.dispatch({ changes: { from: 0, to: current.length, insert: options.value } });
  }, [view, options.value]);

  return {
    ref: setParent,
    view,
    undo: () => { if (view) { undo(view); view.focus(); } },
    redo: () => { if (view) { redo(view); view.focus(); } },
  };
}
