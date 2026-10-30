import type { ContentMeta, ImageMetadata } from "@/types/api";

/**
 * 将原始图片 URL 转为浏览器与构建端一致的稳定键，不改变 URL 的查询参数或大小写。
 * @param src Markdown 中的图片地址
 * @returns 两个独立 32 位摘要组成的十六进制键
 */
export const hashImageUrl = (src: string): string => {
  let first = 0x811C9DC5;
  let second = 0x9E3779B9;
  for (let index = 0; index < src.length; index++) {
    const code = src.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85EBCA6B);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
};

/**
 * 读取已保存图片信息；验证原 URL，避免摘要碰撞或旧元数据套到另一张图片。
 * @param meta 文章已有元数据
 * @param src 当前图片地址
 * @returns 可用于预留布局的图片信息；缺失或损坏时返回 undefined
 */
export const getImageMetadata = (meta: ContentMeta | null | undefined, src: string): ImageMetadata | undefined => {
  const image = meta?.images?.[hashImageUrl(src)];
  if (!image || image.src !== src || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)
    || image.width <= 0 || image.height <= 0 || typeof image.blurhash !== "string") return undefined;
  return image;
};
