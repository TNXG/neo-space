"use client";

import type { EditorMode } from "./EditorModeSwitch";
import type { ContentMeta } from "@/types/api";
import { useMilkdown } from "@neo-space/editor";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PROSE_CLASSES } from "@/components/common/markdown/prose-classes";
import { KatexStyles } from "@/components/common/content/KatexStyles";
import { uploadDashboardImage } from "@/lib/dashboard-content";
import { cn } from "@/lib/utils";
import { BlockToolbar } from "./BlockToolbar";
import { FloatingToolbar } from "./FloatingToolbar";
import { SlashMenu } from "./SlashMenu";
import { SourcePane } from "./SourcePane";
import { useBlockPreviews } from "./use-block-previews";
import "@neo-space/editor/styles.css";

interface ContentEditorSurfaceProps {
  mode: EditorMode;
  value: string;
  meta?: ContentMeta | null;
  onChange: (value: string) => void;
  /** 标题等位于正文上方的内容，随正文一起滚动。 */
  header?: React.ReactNode;
}

/**
 * 上传图片并在失败时给出明确提示；成功返回公开地址。
 * @param file 图片
 * @returns 图片地址
 */
const uploadImage = async (file: File) => {
  const id = toast.loading(`正在上传 ${file.name}`);
  try {
    const result = await uploadDashboardImage(file);
    toast.success("图片已上传", { id });
    return result.url;
  } catch (error) {
    toast.error(error instanceof Error ? `上传失败：${error.message}` : "上传失败", { id });
    throw error;
  }
};

/**
 * 编辑主体：所见即所得、分栏（源码 + 站点渲染预览）与纯源码三种模式共享同一份 Markdown。
 * @param props 模式、正文与修改回调
 * @returns 编辑区
 */
export function ContentEditorSurface({ mode, value, meta, onChange, header }: ContentEditorSurfaceProps) {
  const [uploading, setUploading] = useState(0);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { renderBlock, previews } = useBlockPreviews(meta);
  const upload = async (file: File) => {
    setUploading(count => count + 1);
    try {
      return await uploadImage(file);
    } finally {
      setUploading(count => count - 1);
    }
  };
  const milkdown = useMilkdown({ value, onChange, upload, renderBlock, proseClasses: PROSE_CLASSES, onCopy: () => toast.success("代码已复制") });

  const pickImage = () => fileInput.current?.click();
  const insertFiles = async (files: FileList | null) => {
    const images = Array.from(files ?? []).filter(file => file.type.startsWith("image/"));
    for (const file of images) {
      const src = await upload(file).catch(() => undefined);
      if (!src) continue;
      if (mode === "rich") milkdown.commands?.insertImage(src, file.name.replace(/\.[^.]+$/, ""));
      else onChange(`${value.trimEnd()}\n\n![${file.name.replace(/\.[^.]+$/, "")}](${src})\n`);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <KatexStyles />
      {previews}
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => { void insertFiles(event.target.files); event.target.value = ""; }} />
      {mode === "rich" && (
        <div className="flex h-11 shrink-0 items-center border-b border-border/50 px-2 sm:px-3 lg:px-4">
          <BlockToolbar commands={milkdown.commands} format={milkdown.format} onPickImage={pickImage} uploading={uploading > 0} />
        </div>
      )}

      {/* 富文本实例始终挂载，切换模式不丢失撤销历史与滚动位置。 */}
      <div ref={setScroller} hidden={mode !== "rich"} className="ns-editor min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-12">
          {header}
          <div ref={milkdown.ref} className={cn("transition-opacity duration-(--motion-duration-page) ease-(--motion-ease-out)", !milkdown.ready && "opacity-0")} />
        </div>
      </div>
      {mode === "rich" && (
        <>
          <FloatingToolbar view={milkdown.view} commands={milkdown.commands} format={milkdown.format} revision={milkdown.revision} boundary={scroller} />
          <SlashMenu view={milkdown.view} commands={milkdown.commands} revision={milkdown.revision} onPickImage={pickImage} />
        </>
      )}

      {mode !== "rich" && (
        <SourcePane split={mode === "split"} value={value} meta={meta} onChange={onChange} header={header} onPickImage={pickImage} onPasteImages={files => void insertFiles(files)} uploading={uploading > 0} />
      )}
    </div>
  );
}
