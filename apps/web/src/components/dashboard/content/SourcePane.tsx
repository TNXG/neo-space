"use client";

import { useSourceEditor } from "@neo-space/editor";
import { useEffect, useRef } from "react";
import { MarkdownRendererClient } from "@/components/common/markdown/MarkdownRenderer.client";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { ToolbarButton } from "./FloatingToolbar";

interface SourcePaneProps {
  split: boolean;
  value: string;
  onChange: (value: string) => void;
  header?: React.ReactNode;
  onPickImage: () => void;
  onPasteImages: (files: FileList) => void;
  uploading: boolean;
}

/**
 * 源码模式；分栏时右侧为站点同款渲染预览，两侧按滚动比例同步，哪边被滚动就由哪边驱动。
 * @param props 正文、模式与图片回调
 * @returns 源码面板
 */
export function SourcePane({ split, value, onChange, header, onPickImage, onPasteImages, uploading }: SourcePaneProps) {
  const source = useSourceEditor({ value, onChange, placeholder: "使用 Markdown 书写…" });
  const preview = useRef<HTMLDivElement>(null);
  const driver = useRef<"source" | "preview" | null>(null);

  useEffect(() => {
    const scroller = source.view?.scrollDOM;
    const target = preview.current;
    if (!scroller || !target || !split) return;
    let release = 0;
    /** 只跟随当前被用户操作的一侧，防止两侧互相回推形成抖动。 */
    const sync = (from: HTMLElement, to: HTMLElement, side: "source" | "preview") => () => {
      if (driver.current && driver.current !== side) return;
      driver.current = side;
      const ratio = from.scrollTop / Math.max(1, from.scrollHeight - from.clientHeight);
      to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
      window.clearTimeout(release);
      release = window.setTimeout(() => { driver.current = null; }, 120);
    };
    const fromSource = sync(scroller, target, "source");
    const fromPreview = sync(target, scroller, "preview");
    scroller.addEventListener("scroll", fromSource, { passive: true });
    target.addEventListener("scroll", fromPreview, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", fromSource);
      target.removeEventListener("scroll", fromPreview);
      window.clearTimeout(release);
    };
  }, [source.view, split]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/50 px-2 sm:px-3 lg:px-4">
        <ToolbarButton label="撤销（Ctrl Z）" icon="mingcute:corner-up-left-line" onPress={source.undo} />
        <ToolbarButton label="重做（Ctrl Shift Z）" icon="mingcute:corner-up-right-line" onPress={source.redo} />
        <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
        <ToolbarButton label={uploading ? "图片上传中" : "插入图片"} icon={uploading ? "mingcute:loading-line" : "mingcute:pic-line"} onPress={onPickImage} />
        <span className="ml-2 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Icon icon="mingcute:markdown-line" className="size-4" aria-hidden="true" />
          Markdown · Ctrl F 查找
        </span>
      </div>
      <div className={cn("grid min-h-0 flex-1", split ? "grid-cols-2" : "grid-cols-1")}>
        <div
          className="ns-editor ns-source-pane flex min-h-0 flex-col overflow-hidden"
          onPaste={(event) => {
            if (event.clipboardData.files.length) {
              event.preventDefault();
              onPasteImages(event.clipboardData.files);
            }
          }}
          onDrop={(event) => {
            if (event.dataTransfer.files.length) {
              event.preventDefault();
              onPasteImages(event.dataTransfer.files);
            }
          }}
        >
          {!split && header && <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">{header}</div>}
          <div ref={source.ref} className={cn("min-h-0 flex-1 [&_.cm-editor]:h-full", !split && "mx-auto w-full max-w-3xl px-3 lg:px-6")} />
        </div>
        {split && (
          <div ref={preview} aria-label="预览" className="min-h-0 overflow-y-auto overscroll-contain border-l border-border/50 bg-background">
            <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-[40vh] lg:px-8">
              {header}
              <MarkdownRendererClient content={value} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
