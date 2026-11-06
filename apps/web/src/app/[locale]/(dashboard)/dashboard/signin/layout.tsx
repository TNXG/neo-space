import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { SigninWallpaperProvider } from "@/components/dashboard/sign/SigninWallpaperProvider";
import { Icon } from "@/lib/inline-icon";
import { WallpaperBackdrop } from "./WallpaperBackdrop";

/** 全屏壁纸 + 玻璃导航；壁纸随机选择发生在客户端，不进入服务端渲染。 */
export default async function SignInLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = locale === "zh" ? "/" : `/${locale}`;

  return (
    <SigninWallpaperProvider>
      <div className="relative isolate flex min-h-svh flex-col overflow-x-clip bg-background text-foreground leading-[1.6]">
        <WallpaperBackdrop />
        <header className="flex shrink-0 justify-end px-4 py-3 lg:px-8">
          <div className="flex items-center gap-1 rounded-full border border-border/40 bg-background/55 p-1 backdrop-blur-xl reduced-transparency:border-border reduced-transparency:bg-background reduced-transparency:backdrop-blur-none">
            <Link
              href={home}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon icon="mingcute:arrow-left-line" aria-hidden="true" />返回站点
            </Link>
            <ThemeToggle className="text-foreground" />
          </div>
        </header>
        <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:py-10">
          {children}
        </main>
      </div>
    </SigninWallpaperProvider>
  );
}
