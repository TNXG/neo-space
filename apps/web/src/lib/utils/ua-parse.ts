import type { UAClientHintsInfo, UAInfo } from "@/types/api";
import { UAParser } from "ua-parser-js";

interface UAParseResultSnapshot {
  device: {
    type?: string;
    model?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
  cpu: {
    architecture?: string;
  };
}

function normalizeText(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "unknown";
}

function normalizeDevice(value?: string | null): UAInfo["device"] {
  if (value === "mobile" || value === "tablet" || value === "desktop") {
    return value;
  }
  return "unknown";
}

function buildClientHintsSnapshot(result: UAParseResultSnapshot): UAClientHintsInfo | undefined {
  const snapshot: UAClientHintsInfo = {
    mobile: result.device.type === "mobile",
    platform: normalizeText(result.os.name),
    platformVersion: normalizeText(result.os.version),
    architecture: normalizeText(result.cpu.architecture),
    model: result.device.model || undefined,
  };

  const hasUsefulData = Object.values(snapshot).some(value => value !== undefined && value !== "unknown");
  return hasUsefulData ? snapshot : undefined;
}

/**
 * 获取用户代理信息
 * 优先使用 Client Hints API（仅在 Chromium 浏览器中可用），
 * 自动降级到 User-Agent 字符串解析
 */
export async function getUAInfo(): Promise<UAInfo> {
  const rawUserAgent = navigator.userAgent || "unknown";

  try {
    const parser = new UAParser(rawUserAgent);
    // 统一交给 ua-parser-js 内部的 Client Hints 能力处理。
    const result = await parser.getResult().withClientHints();

    return {
      browser: normalizeText(result.browser.name),
      browserVersion: normalizeText(result.browser.version),
      os: normalizeText(result.os.name),
      osVersion: normalizeText(result.os.version),
      device: normalizeDevice(result.device.type),
      rawUserAgent,
      clientHints: buildClientHintsSnapshot(result),
    };
  } catch (e) {
    console.warn("Failed to parse user agent:", e);
    const parser = new UAParser(rawUserAgent);
    const result = parser.getResult();

    return {
      browser: normalizeText(result.browser.name),
      browserVersion: normalizeText(result.browser.version),
      os: normalizeText(result.os.name),
      osVersion: normalizeText(result.os.version),
      device: normalizeDevice(result.device.type),
      rawUserAgent,
      clientHints: buildClientHintsSnapshot(result),
    };
  }
}
