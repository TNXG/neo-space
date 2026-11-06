"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useSigninWallpaper, type SigninWallpaper } from "@/hooks/use-signin-wallpaper";

interface SigninWallpaperState {
  /** 壁纸元信息；未就绪时为 undefined。 */
  wallpaper?: SigninWallpaper;
  /** 壁纸已可绘制（JXL 首批数据渲染完成），卡片底纹此时才填充。 */
  painted: boolean;
  markPainted: () => void;
}

const SigninWallpaperContext = createContext<SigninWallpaperState | null>(null);

/** 壁纸与卡片共用同一份元信息与绘制状态。 */
export function SigninWallpaperProvider({ children }: { children: ReactNode }) {
  const wallpaper = useSigninWallpaper();
  const [painted, setPainted] = useState(false);
  const markPainted = useCallback(() => setPainted(true), []);
  const value = useMemo(() => ({ wallpaper, painted, markPainted }), [wallpaper, painted, markPainted]);
  return <SigninWallpaperContext.Provider value={value}>{children}</SigninWallpaperContext.Provider>;
}

/** 读取壁纸状态；必须在 SigninWallpaperProvider 内使用。 */
export function useSigninWallpaperState(): SigninWallpaperState {
  const state = useContext(SigninWallpaperContext);
  if (!state) throw new Error("useSigninWallpaperState must be used within SigninWallpaperProvider");
  return state;
}
