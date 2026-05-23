export const WEB_URL: string
  = (import.meta.env.VITE_APP_WEB_URL as string) || "http://localhost:2323";

export const bgUrl
  = (import.meta.env.VITE_APP_LOGIN_BG as string)
    || "https://api-space.tnxg.top/images/wallpaper?type=cdn";

// admin 由 Rust 后端同源托管，API 始终走相对路径
export const API_URL = transformUrl(
  import.meta.env.DEV
    ? (import.meta.env.VITE_APP_BASE_API as string) || "http://localhost:8000/api"
    : "/api",
);

export const GATEWAY_URL = transformUrl(
  import.meta.env.DEV
    ? (import.meta.env.VITE_APP_GATEWAY as string) || ""
    : "",
);

function transformUrl(url: string) {
  if (!url)
    return "";
  if (url === "/")
    return location.origin;
  if (url.startsWith("/")) {
    return location.origin + url;
  }

  return url.endsWith("/") ? url.slice(0, -1) : url;
}
