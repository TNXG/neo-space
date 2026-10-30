export const IMAGE_TIMEOUT_MS = 15_000;
const THUMBNAIL_EDGE = 128;

interface ImageDimensions { width: number; height: number }
export interface DecodedScanImage extends ImageDimensions { pixels: Uint8ClampedArray; bytes: number; thumbnailWidth: number; thumbnailHeight: number }

/** Deliberately public scan failure text, never an underlying browser exception or source URL. */
export class ImageScanError extends Error {}

/** Read a CORS-accessible image without forwarding credentials. */
const fetchImageBlob = async (src: string, signal: AbortSignal): Promise<Blob> => {
  let url: URL;
  try { url = new URL(src, document.baseURI); } catch { throw new ImageScanError("图片链接无效"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new ImageScanError("仅支持不含用户名或密码的 HTTP(S) 图片链接");
  }
  let response: Response;
  try {
    response = await fetch(url, { signal, mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
  } catch {
    throw new ImageScanError(signal.aborted ? "图片处理超时" : "图片下载失败，图片源需要允许浏览器 CORS 读取");
  }
  if (!response.ok) throw new ImageScanError(`图片下载失败（HTTP ${response.status}）`);
  return response.blob();
};

/** Decode browser-supported images and sample a high-quality sRGB thumbnail without changing original dimensions. */
export const downloadScanImage = async (src: string, signal: AbortSignal): Promise<DecodedScanImage> => {
  const blob = await fetchImageBlob(src, signal);
  if (signal.aborted) throw new ImageScanError("图片处理超时");
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  const abort = () => { image.src = ""; };
  signal.addEventListener("abort", abort, { once: true });
  try {
    image.src = objectUrl;
    await image.decode();
    if (signal.aborted) throw new ImageScanError("图片处理超时");
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width < 1 || height < 1) throw new ImageScanError("无法读取图片尺寸");
    const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(width, height));
    const thumbnailWidth = Math.max(1, Math.round(width * scale));
    const thumbnailHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
    if (!context) throw new ImageScanError("浏览器无法创建图片采样画布");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, thumbnailWidth, thumbnailHeight);
    const pixels = context.getImageData(0, 0, thumbnailWidth, thumbnailHeight).data;
    canvas.width = 0;
    canvas.height = 0;
    return { width, height, pixels, bytes: blob.size, thumbnailWidth, thumbnailHeight };
  } finally {
    signal.removeEventListener("abort", abort);
    image.src = "";
    URL.revokeObjectURL(objectUrl);
  }
};
