import type { UAInfo } from "@/types/api";
import { UAParser } from "ua-parser-js";

/**
 * 获取用户代理信息
 * 优先使用 Client Hints API（仅在 Chromium 浏览器中可用），
 * 自动降级到 User-Agent 字符串解析
 */
export async function getUAInfo(): Promise<UAInfo> {
  try {
    const parser = new UAParser();
    // withClientHints() 会自动在支持的浏览器中优先使用 Client Hints API
    // 如果不支持，则直接使用 User-Agent 字符串解析
    const result = await parser.getResult().withClientHints();

    return {
      browser: result.browser.name || "Unknown",
      browserVersion: result.browser.version || "Unknown",
      os: result.os.name || "Unknown",
      osVersion: result.os.version || "Unknown",
      device: (result.device.type as "mobile" | "desktop") || "desktop",
    };
  } catch (e) {
    console.warn("Failed to parse user agent:", e);
    // 降级方案：直接使用 user-agent 字符串
    const parser = new UAParser();
    const result = parser.getResult();

    return {
      browser: result.browser.name || "Unknown",
      browserVersion: result.browser.version || "Unknown",
      os: result.os.name || "Unknown",
      osVersion: result.os.version || "Unknown",
      device: (result.device.type as "mobile" | "desktop") || "desktop",
    };
  }
}
