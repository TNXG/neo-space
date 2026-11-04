import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { Icon } from "@/lib/inline-icon";

const WALLPAPER_URL = "https://api-space.tnxg.top/images/wallpaper?type=cdn";

/** 保留完整壁纸，使用实底导航与登录卡片隔离文字和背景。 */
export default async function SignInLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = locale === "zh" ? "/" : `/${locale}`;

  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-x-clip bg-background text-foreground leading-[1.6]">
      <Image
        src={WALLPAPER_URL}
        alt=""
        fill
        unoptimized
        preload
        sizes="100vw"
        className="-z-10 object-cover"
      />
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
