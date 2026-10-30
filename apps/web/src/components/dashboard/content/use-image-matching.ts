"use client";

import type { ContentMeta } from "@/types/api";
import type { ImageScanUpdate } from "@/lib/image-scan";
import type { ContentDraft } from "./content-model";
import { useEffect, useRef, useState } from "react";
import { scanContentImages } from "@/lib/image-scan";

/** 属性面板共享的图片匹配状态；逐图处理状态不写入文章。 */
export interface ImageMatchingState {
  matching: boolean;
  match: () => Promise<void>;
  updates: Record<string, ImageScanUpdate>;
  progress?: { done: number; total: number };
  processor?: "gpu" | "cpu";
  error?: string;
}

/**
 * 点击时在浏览器扫描并计算图片信息，只更新现有 meta，沿用正常保存路径。
 * @param draft 当前文档
 * @param onChange 写入完整元数据的回调
 * @returns 扫描状态、逐图结果与属性面板操作
 */
export const useImageMatching = (draft: ContentDraft | undefined, onChange: (meta: ContentMeta) => void): ImageMatchingState => {
  const [matching, setMatching] = useState(false);
  const [updates, setUpdates] = useState<Record<string, ImageScanUpdate>>({});
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [processor, setProcessor] = useState<"gpu" | "cpu">();
  const [error, setError] = useState<string>();
  const latest = useRef({ draft, onChange });
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { latest.current = { draft, onChange }; }, [draft, onChange]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /** 匹配期间不阻止继续编辑；结果合并到最新 meta，不覆盖其他字段。 */
  const match = async () => {
    const source = latest.current.draft;
    if (!source || active.current) return;
    active.current = true;
    setMatching(true);
    setUpdates({});
    setProgress(undefined);
    setProcessor(undefined);
    setError(undefined);
    try {
      const result = await scanContentImages(source.text, (done, total) => {
        if (mounted.current) setProgress({ done, total });
      }, (update) => {
        if (mounted.current) setUpdates(current => ({ ...current, [update.src]: update }));
      });
      const current = latest.current.draft;
      if (!mounted.current || !current) return;
      setProcessor(result.processor);
      const count = Object.keys(result.images).length;
      if (count) latest.current.onChange({ ...current.meta, images: { ...current.meta?.images, ...result.images } });
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : "图片匹配失败");
    } finally {
      active.current = false;
      if (mounted.current) setMatching(false);
    }
  };

  return { matching, match, updates, progress, processor, error };
};
