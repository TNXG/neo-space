"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useDashboardSession } from "@/hooks/use-dashboard-session";
import { usePathname, useRouter } from "@/locales/navigation";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "./DashboardShell";
import { DashboardWorkspaceSkeleton } from "./DashboardWorkspaceSkeleton";

/** 客户端会话守卫只提供导航体验，数据授权仍由 Rust 执行。 */
export function DashboardWorkspace({ children }: { children?: ReactNode }) {
  const session = useDashboardSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session.data === null) router.replace("/dashboard/signin");
  }, [session.data, router]);
  if (session.error) return <main className="flex min-h-svh flex-col items-center justify-center gap-4"><p role="alert">暂时无法验证会话</p><Button variant="outline" onClick={() => { void session.mutate(); }}>重试</Button></main>;
  if (!session.data) return <DashboardWorkspaceSkeleton settings={pathname.startsWith("/dashboard/settings")} groupSlug={pathname.split("/")[3]} />;
  return <DashboardShell user={session.data}>{children}</DashboardShell>;
}
