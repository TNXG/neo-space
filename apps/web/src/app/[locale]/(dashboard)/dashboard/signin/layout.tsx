import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { Icon } from "@/lib/inline-icon";

/** 登录页保留观测站场景，不向工作区继承装饰背景与居中容器。 */
export default async function SignInLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = locale === "zh" ? "/" : `/${locale}`;

  return (
    <div className="observatory relative isolate flex min-h-svh flex-col overflow-hidden bg-background text-foreground leading-[1.6]">
      <div aria-hidden="true" className="observatory-nebula pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="observatory-stars pointer-events-none absolute inset-0" />
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-6 py-3 lg:px-12 lg:py-4">
        <Link href={home} className="flex cursor-pointer items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-ring" aria-label="Neo Space · 返回站点">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full border border-primary/40 text-primary">
            <Icon icon="mingcute:planet-line" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">NEO SPACE<span className="mt-0.5 block text-[0.625rem] font-normal tracking-[0.25em] text-muted-foreground">PERSONAL OBSERVATORY</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href={home} className="hidden cursor-pointer items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex">
            <Icon icon="mingcute:arrow-left-line" aria-hidden="true" />返回站点
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-3 lg:px-12">
        {children}
      </main>
      <footer className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/50 px-6 py-2 font-mono text-[0.625rem] tracking-[0.15em] text-muted-foreground lg:px-12">
        <span>NEO SPACE <span aria-hidden="true" className="mx-2">/</span> A LITTLE SPACE, AN INFINITE WORLD.</span>
        <span className="hidden sm:inline">星海无垠 · 灵感有归处</span>
      </footer>
    </div>
  );
}
