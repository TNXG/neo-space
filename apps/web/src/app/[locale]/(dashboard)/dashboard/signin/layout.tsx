import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { Icon } from "@/lib/inline-icon";

const WALLPAPER_JXL_URL = "https://api-space.tnxg.top/images/wallpaper?mode=redirect&source=cdcn&format=jxl";
const WALLPAPER_FALLBACK_URL = "https://api-space.tnxg.top/images/wallpaper?mode=redirect&source=cdcn&format=original";

/** 保留完整壁纸，使用实底导航与登录卡片隔离文字和背景。 */
export default async function SignInLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = locale === "zh" ? "/" : `/${locale}`;

  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-x-clip bg-background text-foreground leading-[1.6]">
      <picture>
        <source srcSet={WALLPAPER_JXL_URL} type="image/jxl" />
        <img
          src={WALLPAPER_FALLBACK_URL}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full select-none object-cover"
        />
      </picture>
      <header className="flex shrink-0 justify-end px-4 py-3 lg:px-8">
        <div className="flex items-center gap-1 rounded-full border border-border bg-background px-2">
          <Link href={home} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
            <Icon icon="mingcute:arrow-left-line" aria-hidden="true" />返回站点
          </Link>
          <ThemeToggle className="text-foreground" />
        </div>
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
