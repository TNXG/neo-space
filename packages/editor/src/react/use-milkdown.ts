"use client";

import type { Editor } from "@milkdown/kit/core";
import type { Node } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { ProseClassMap } from "../core/prose-classes";
import type { BlockPreviewRenderer } from "../syntax/container";
import type { EditorCommands, FormatState } from "../core/commands";
import { languages } from "@codemirror/language-data";
import { editorViewCtx } from "@milkdown/kit/core";
import { replaceAll } from "@milkdown/kit/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { createCommands, readFormatState } from "../core/commands";
import { createSiteEditor } from "../core/create-editor";

export interface UseMilkdownOptions {
  value: string;
  onChange: (markdown: string) => void;
  upload?: (file: File) => Promise<string>;
  renderBlock?: BlockPreviewRenderer;
  onCopy?: (text: string) => void;
  proseClasses?: ProseClassMap;
}

export interface MilkdownHandle {
  /** 挂载点 ref。 */
  ref: (element: HTMLDivElement | null) => void;
  ready: boolean;
  view?: EditorView;
  commands?: EditorCommands;
  format?: FormatState;
  /** 每次事务递增，供浮动 UI 重新测量。 */
  revision: number;
}

/**
 * 管理 Milkdown 生命周期：挂载时创建，卸载时销毁，外部值仅在与编辑器输出不同时回写。
 * @param options 编辑器参数
 * @returns 挂载 ref、命令与格式状态
 */
export function useMilkdown(options: UseMilkdownOptions): MilkdownHandle {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState<Editor>();
  const [view, setView] = useState<EditorView>();
  const [format, setFormat] = useState<FormatState>();
  const [revision, setRevision] = useState(0);
  const latest = useRef(options);
  const emitted = useRef(options.value);
  const baseline = useRef<{ doc: Node; markdown: string }>(undefined);
  const replacing = useRef(false);
  latest.current = options;

  useEffect(() => {
    if (!root) return;
    let disposed = false;
    let instance: Editor | undefined;
    const initialMarkdown = latest.current.value;
    createSiteEditor({
      root,
      value: initialMarkdown,
      languages,
      onChange: (markdown) => {
        if (disposed || !instance || replacing.current) return;
        const doc = instance.ctx.get(editorViewCtx).state.doc;
        // 初始化的序列化与撤销回原文都不能制造文件差异。
        const next = baseline.current?.doc.eq(doc) ? baseline.current.markdown : markdown;
        if (next === emitted.current) return;
        emitted.current = next;
        latest.current.onChange(next);
      },
      onView: (next) => {
        setView(next);
        setFormat(readFormatState(next.state));
        setRevision(value => value + 1);
      },
      upload: file => latest.current.upload ? latest.current.upload(file) : Promise.reject(new Error("未配置上传")),
      renderBlock: (host, markdown) => latest.current.renderBlock?.(host, markdown),
      onCopy: text => latest.current.onCopy?.(text),
      proseClasses: latest.current.proseClasses,
    }).create().then((created) => {
      if (disposed) {
        void created.destroy();
        return;
      }
      instance = created;
      baseline.current = { doc: created.ctx.get(editorViewCtx).state.doc, markdown: initialMarkdown };
      emitted.current = initialMarkdown;
      setEditor(created);
    });
    return () => {
      disposed = true;
      setEditor(undefined);
      setView(undefined);
      void instance?.destroy();
    };
  }, [root]);

  /** 外部替换内容（如放弃修改、加载完成）时同步到编辑器，不打断用户自己的输入。 */
  useEffect(() => {
    if (!editor || options.value === emitted.current) return;
    emitted.current = options.value;
    replacing.current = true;
    try {
      editor.action(replaceAll(options.value, true));
      baseline.current = { doc: editor.ctx.get(editorViewCtx).state.doc, markdown: options.value };
    } finally {
      replacing.current = false;
    }
  }, [editor, options.value]);

  const commands = useMemo(() => editor ? createCommands(editor) : undefined, [editor]);
  const liveView = editor ? editor.ctx.get(editorViewCtx) : view;

  return { ref: setRoot, ready: Boolean(editor), view: liveView, commands, format, revision };
}
