"use client";

import useSWR from "swr";

const WALLPAPER_METADATA_URL = "https://api-space.tnxg.top/images/wallpaper?mode=json&source=cdcn";
const SIGNIN_WALLPAPER_KEY = "signin-wallpaper";

/** 同一响应中的 blurhash 与直链，保证底纹与实际壁纸是同一张图。 */
export interface SigninWallpaper {
  blurhash?: string;
  jxlUrl?: string;
  /** 原始 JPG/PNG 直链，用于不支持 JXL 的浏览器。 */
  fallbackUrl?: string;
}

/** 浏览器端取当前壁纸元信息；随机图的选择完全发生在客户端，不进入服务端渲染。 */
async function fetchSigninWallpaper(): Promise<SigninWallpaper> {
  const response = await fetch(WALLPAPER_METADATA_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`wallpaper metadata ${response.status}`);
  const payload = (await response.json()) as {
    data?: { blurhash?: string; jxl?: { cdcn?: string }; original?: { cdcn?: string } };
  };
  const data = payload.data;
  if (!data) throw new Error("wallpaper metadata empty");
  return {
    blurhash: data.blurhash,
    jxlUrl: data.jxl?.cdcn,
    fallbackUrl: data.original?.cdcn,
  };
}

/** 登录页壁纸与卡片底纹共用的元信息，单次请求、会话内复用。 */
export function useSigninWallpaper(): SigninWallpaper | undefined {
  const { data } = useSWR(SIGNIN_WALLPAPER_KEY, fetchSigninWallpaper, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return data;
}
