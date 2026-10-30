"use client";

import type { ContentDraft } from "./content-model";
import type { ImageMatchingState } from "./use-image-matching";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { collectContentImageSources } from "@/lib/image-scan-sources";
import { Icon } from "@/lib/inline-icon";
import { getImageMetadata } from "@/utils/images/common";

interface ImageMetadataPanelProps {
  draft: ContentDraft;
  matching: ImageMatchingState;
  disabled: boolean;
}

const STATUS_LABEL = {
  idle: "未匹配",
  queued: "等待处理",
  processing: "处理中",
  success: "已匹配",
  failed: "失败",
} as const;

/** 将原图文件大小转换为便于阅读的单位，缺失时不显示。 */
const formatBytes = (bytes: number) => bytes < 1024
  ? `${bytes} B`
  : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

/**
 * 属性面板里的图片匹配入口与逐链接结果；已保存的信息无需重新扫描即可查看。
 * @param props 当前文档、扫描状态与保存锁定状态
 * @returns 图片属性区域
 */
export function ImageMetadataPanel({ draft, matching, disabled }: ImageMetadataPanelProps) {
  const sources = useMemo(() => collectContentImageSources(draft.text), [draft.text]);
  const rows = sources.map((src) => {
    const update = matching.updates[src];
    const image = update?.status === "success" ? update.image : getImageMetadata(draft.meta, src);
    const status: keyof typeof STATUS_LABEL = update?.status ?? (image ? "success" : "idle");
    return { src, image, status, message: update?.status === "failed" ? update.message : undefined };
  });
  const succeeded = rows.filter(row => row.status === "success").length;
  const failed = rows.filter(row => row.status === "failed").length;

  return (
    <section aria-labelledby="content-images-title" className="flex min-w-0 flex-col gap-3 border-t border-border/50 pt-5">
      <div className="flex items-center justify-between gap-2">
        <h3 id="content-images-title" className="text-sm font-medium">图片链接</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{sources.length} 个</span>
      </div>
      <Button type="button" variant="outline" size="sm" className="w-full cursor-pointer" disabled={matching.matching || disabled || !sources.length} onClick={() => { void matching.match(); }}>
        {matching.matching ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Icon icon="mingcute:pic-line" data-icon="inline-start" aria-hidden="true" />}
        {matching.matching ? `正在匹配 ${matching.progress?.done ?? 0}/${matching.progress?.total ?? sources.length}` : "匹配图片链接"}
      </Button>
      <p role="status" aria-live="polite" className="text-xs leading-relaxed text-muted-foreground">
        {!sources.length ? "正文中暂无图片链接。" : `${succeeded} 个已匹配${failed ? `，${failed} 个失败` : ""}${matching.processor ? ` · ${matching.processor.toUpperCase()}` : ""}`}
      </p>
      {matching.error && <p role="alert" className="text-xs leading-relaxed wrap-anywhere text-destructive">{matching.error}</p>}
      {!!sources.length && (
        <ul aria-label="图片链接匹配结果" className="flex min-w-0 flex-col divide-y divide-border/50">
          {rows.map(({ src, status, image, message }, index) => (
            <li key={src} data-image-source={src} data-image-status={status} className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="tabular-nums text-muted-foreground">图片 {index + 1}</span>
                <span className={`flex items-center gap-1.5 ${status === "failed" ? "text-destructive" : status === "success" ? "text-primary" : "text-muted-foreground"}`}>
                  {status === "processing" && <Spinner className="size-3" aria-hidden="true" />}
                  {STATUS_LABEL[status]}
                </span>
              </div>
              <p className="font-mono text-xs leading-relaxed wrap-anywhere text-foreground">{src}</p>
              {image && (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {image.width} × {image.height}{image.bytes !== undefined ? ` · ${formatBytes(image.bytes)}` : ""}
                </p>
              )}
              {message && <p className="text-xs leading-relaxed wrap-anywhere text-destructive">{message}</p>}
            </li>
          ))}
        </ul>
      )}
      {!!sources.length && <p className="text-xs leading-relaxed text-muted-foreground">匹配结果随文档保存。跨域图片需允许 CORS 读取。</p>}
    </section>
  );
}
