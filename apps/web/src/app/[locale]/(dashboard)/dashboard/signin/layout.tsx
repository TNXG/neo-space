import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { Icon } from "@/lib/inline-icon";

const WALLPAPER_URL = "https://api-space.tnxg.top/images/wallpaper?type=cdn";

/** 登录页只保留登录卡片、返回站点与主题切换，背景为随机壁纸。 */
export default async function SignInLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = locale === "zh" ? "/" : `/${locale}`;

  return (
    <div className="observatory relative isolate flex min-h-svh flex-col overflow-hidden bg-background text-foreground leading-[1.6]">
      <img
        src={WALLPAPER_URL}
        alt="background"
        sizes="100vw"
        className="absolute inset-0 w-full h-full -z-10 object-cover"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-background/40" />
      <header className="flex shrink-0 items-center justify-end gap-2 px-5 py-3 lg:px-8">
        <Link href={home} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <Icon icon="mingcute:arrow-left-line" aria-hidden="true" />返回站点
        </Link>
        <ThemeToggle />
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-5 py-8">
        {children}
      </main>
    </div>
  );
}
