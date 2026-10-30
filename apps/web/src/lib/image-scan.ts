"use client";

import type { ImageMetadata } from "@/types/api";
import { hashImageUrl } from "@/utils/images/common";

import { blurhashFromCoefficients, linearizePixels } from "./image-scan-blurhash";
import { downloadScanImage, IMAGE_TIMEOUT_MS, ImageScanError } from "./image-scan-download";
import { createCoefficientProcessor } from "./image-scan-gpu";
import { collectContentImageSources } from "./image-scan-sources";

export interface ImageScanResult {
  images: Record<string, ImageMetadata>;
  errors: { src: string; message: string }[];
  processor: "gpu" | "cpu";
}

/** 每张图片的即时处理结果，供属性面板逐条展示。 */
export type ImageScanUpdate =
  | { src: string; status: "queued" | "processing" }
  | { src: string; status: "success"; image: ImageMetadata }
  | { src: string; status: "failed"; message: string };

/** Scan actual content images in the browser and prepare article meta.images without changing Markdown. */
export const scanContentImages = async (
  text: string,
  onProgress?: (done: number, total: number) => void,
  onImage?: (update: ImageScanUpdate) => void,
): Promise<ImageScanResult> => {
  if (typeof window === "undefined") throw new Error("图片匹配只能在浏览器中运行");
  const sources = collectContentImageSources(text);
  const result: ImageScanResult = { images: {}, errors: [], processor: "cpu" };
  onProgress?.(0, sources.length);
  if (!sources.length) return result;
  sources.forEach(src => onImage?.({ src, status: "queued" }));
  const processor = await createCoefficientProcessor();
  try {
    for (let index = 0; index < sources.length; index++) {
      const src = sources[index];
      const key = hashImageUrl(src);
      if (result.images[key] && result.images[key].src !== src) {
        const message = "图片 URL 哈希冲突，未覆盖已有元数据";
        result.errors.push({ src, message });
        onImage?.({ src, status: "failed", message });
        onProgress?.(index + 1, sources.length);
        continue;
      }
      onImage?.({ src, status: "processing" });
      const controller = new AbortController();
      const deadline = Promise.withResolvers<never>();
      const timer = window.setTimeout(() => {
        controller.abort();
        deadline.reject(new ImageScanError("图片处理超时（15 秒）"));
      }, IMAGE_TIMEOUT_MS);
      try {
        /** Keep asynchronous work side-effect-free so late decoder completion cannot mutate scan results. */
        const processImage = async (): Promise<ImageMetadata> => {
          const decoded = await downloadScanImage(src, controller.signal);
          if (controller.signal.aborted) throw new ImageScanError("图片处理超时");
          const pixels = linearizePixels(decoded.pixels);
          const coefficients = await processor.compute(pixels, decoded.thumbnailWidth, decoded.thumbnailHeight);
          return {
            src,
            width: decoded.width,
            height: decoded.height,
            bytes: decoded.bytes,
            blurhash: blurhashFromCoefficients(coefficients),
          };
        };
        result.images[key] = await Promise.race([processImage(), deadline.promise]);
        onImage?.({ src, status: "success", image: result.images[key] });
      } catch (error) {
        // Decoder/canvas exceptions can embed URLs or implementation details; only our bounded messages are public.
        const message = error instanceof ImageScanError
          ? error.message : "图片解码失败，请确认图片格式受当前浏览器支持";
        result.errors.push({ src, message });
        onImage?.({ src, status: "failed", message });
      } finally {
        window.clearTimeout(timer);
        controller.abort();
      }
      onProgress?.(index + 1, sources.length);
    }
    result.processor = processor.kind;
    return result;
  } finally {
    processor.dispose();
  }
};
