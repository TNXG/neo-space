"use client";

import Image from "next/image";
import { useEffect } from "react";
import { BlurhashPlaceholder } from "@/components/common/content/BlurhashPlaceholder";
import { Button } from "@/components/ui/button";
import { useDashboardLogin } from "@/hooks/use-dashboard-login";
import { useDashboardSession } from "@/hooks/use-dashboard-session";
import { Icon } from "@/lib/inline-icon";
import { useRouter } from "@/locales/navigation";
import { useSigninWallpaperState } from "@/components/dashboard/sign/SigninWallpaperProvider";
import { LoginForm } from "./LoginForm";
import { OwnerIdentity } from "./OwnerIdentity";

interface LoginPanelProps {
  initialError?: string;
}

/** 双列玻璃卡片：左侧品牌栏 + 右侧登录区，底纹用同源 blurhash 做无接缝环境色。 */
export function LoginPanel({ initialError }: LoginPanelProps) {
  const login = useDashboardLogin(initialError);
  const session = useDashboardSession();
  const { wallpaper, painted } = useSigninWallpaperState();
  const router = useRouter();
  useEffect(() => {
    if (login.user) router.replace("/dashboard");
  }, [login.user, router]);
  const message = login.error || login.queryError || login.optionsError || login.passkeyError || (session.error ? "暂时无法验证会话，请检查后台连接。" : "");

  return (
    <section
      aria-labelledby="dashboard-login-title"
      className="relative isolate mx-auto grid w-full max-w-md overflow-hidden rounded-[1.75rem] bg-card/60 text-foreground shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] backdrop-blur-2xl reduced-transparency:bg-background reduced-transparency:backdrop-blur-none lg:max-w-4xl lg:grid-cols-[0.9fr_1fr]"
    >
      {/* 底纹：壁纸可绘制后才填充整张 blurhash，再叠一层模糊；外扩避免边缘泛白 */}
      {painted && wallpaper?.blurhash && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <BlurhashPlaceholder hash={wallpaper.blurhash} />
          <div className="absolute -inset-10 bg-background/30 backdrop-blur-3xl" />
        </div>
      )}

      <div className="relative flex items-center justify-between gap-4 overflow-hidden border-b border-border/40 px-6 py-5 lg:flex-col lg:justify-center lg:gap-8 lg:border-r lg:border-b-0 lg:px-8 lg:py-12">
        <div className="flex min-w-0 flex-col gap-2 lg:items-center lg:text-center">
          <span className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">Neo Space</span>
          <p className="text-lg font-medium tracking-tight text-balance lg:text-xl">故事从这里继续。</p>
        </div>
        <Image
          src="/angel-sticker.webp"
          alt=""
          width={956}
          height={1422}
          sizes="(min-width: 1024px) 240px, 88px"
          preload
          className="pointer-events-none relative h-auto w-22 shrink-0 select-none drop-shadow-sm lg:w-56"
        />
        <p className="hidden text-sm text-muted-foreground lg:block">记录日常，收藏灵感。</p>
      </div>

      <div className="flex min-w-0 flex-col gap-6 p-6 lg:p-9">
        <div className="flex flex-col gap-2">
          <h2 id="dashboard-login-title" className="text-2xl font-semibold tracking-tight">{login.user ? "欢迎归航" : "欢迎回来"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{login.user ? "身份已确认，你已回到自己的空间。" : "登录你的空间，继续记录。"}</p>
        </div>

        {!login.user && <OwnerIdentity profile={login.profile} identifying={login.identifying} unmatched={login.unmatched} />}

        {login.user ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Icon icon="mingcute:check-line" aria-hidden="true" />登录成功，正在进入工作区…
          </p>
        ) : <LoginForm login={login} />}

        {(message || (!login.user && (login.queryError || login.optionsError))) && (
          <div className="flex flex-col gap-2">
            {message && (
              <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm leading-relaxed text-foreground">
                {message}
              </p>
            )}
            {!login.user && (login.queryError || login.optionsError) && (
              <Button variant="link" size="sm" className="w-fit cursor-pointer px-0" onClick={login.retry}>重试</Button>
            )}
          </div>
        )}

        <p className="flex items-center justify-center gap-1.5 border-t border-border/60 pt-5 text-xs text-muted-foreground">
          <Icon icon="mingcute:lock-line" aria-hidden="true" />仅向空间主人开放
        </p>
      </div>
    </section>
  );
}
