"use client";

import type { Reader } from "@/types/api";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { useRouter } from "@/locales/navigation";
import { logoutDashboard, DASHBOARD_SESSION_KEY, DASHBOARD_PROFILE_KEY } from "@/lib/dashboard-api";
import { DASHBOARD_OPTIONS_KEY } from "@/lib/dashboard-options";
 
/** 展示服务端已验证的主人身份；退出成功后替换历史，失败保留当前工作区。 */
export function DashboardAccount({ user, collapsed = false }: { user: Reader; collapsed?: boolean }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { resolvedTheme, setTheme } = useTheme();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  /** 保留既有 HttpOnly 会话退出入口，不在浏览器保存凭据。 */
  const signOut = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const result = await logoutDashboard();
      if (result.status !== "success") {
        setError(result.message || "退出失败，请重试。");
        return;
      }
      await mutate(DASHBOARD_SESSION_KEY, null, { revalidate: false });
      await mutate(DASHBOARD_PROFILE_KEY, undefined, { revalidate: false });
      await mutate(DASHBOARD_OPTIONS_KEY, undefined, { revalidate: false });
      router.replace("/dashboard/signin");
    } catch {
      setError("退出失败，请检查连接后重试。");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
        <section aria-label="账户" className="flex w-full flex-col gap-3">
          <div className={cn("grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3", collapsed && "grid-cols-1")} aria-hidden="true">
            <Separator className="bg-foreground/15" />
            {!collapsed && <span className="text-[0.6875rem] font-medium tracking-[0.12em] text-muted-foreground">ACCOUNT</span>}
            {!collapsed && <Separator className="bg-foreground/15" />}
          </div>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`${user.name}，账户选项`} title="账户选项" className={cn("group/account grid min-h-16 w-full cursor-pointer touch-manipulation grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-foreground outline-none transition-colors duration-150 hover:bg-foreground/5 active:bg-foreground/10 active:duration-0 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-foreground/8 motion-reduce:transition-none", collapsed && "grid-cols-1 justify-items-center px-0")}>
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-medium text-foreground/70">
                {user.image && failedAvatar !== user.image ? (
                  <Image src={user.image} alt="" width={40} height={40} unoptimized className="size-full object-cover" onError={() => setFailedAvatar(user.image)} />
                ) : <span aria-hidden="true">{user.name.trim().slice(0, 2).toUpperCase() || "?"}</span>}
              </span>
              {!collapsed && (
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.6]">
                  <span className="truncate text-[0.8125rem] font-medium">{user.name}</span>
                  {user.handle && <span className="truncate text-xs text-foreground/65">{user.handle}</span>}
                </span>
              )}
              {!collapsed && <Icon icon="mingcute:down-line" className="size-4 rotate-180 text-foreground/50 group-hover/account:text-foreground group-data-[state=open]/account:rotate-0" aria-hidden="true" />}
            </button>
          </PopoverTrigger>
        </section>
      <PopoverContent side={collapsed ? "right" : "top"} align="end" sideOffset={8} collisionPadding={12} aria-label="账户选项" className="w-56 max-w-[calc(100vw-1.5rem)] rounded-xl border-border bg-background p-1.5 text-foreground shadow-none backdrop-blur-none motion-reduce:animate-none">
        <div className="flex flex-col gap-1">
          <Button type="button" variant="ghost" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="h-10 w-full justify-start rounded-lg px-3 max-lg:h-11">
            <Icon icon={resolvedTheme === "dark" ? "mingcute:sun-line" : "mingcute:moon-line"} data-icon="inline-start" aria-hidden="true" />
            切换主题
            <span className="ml-auto text-xs text-muted-foreground">{resolvedTheme === "dark" ? "深色" : "浅色"}</span>
          </Button>
          <Separator />
          <Button type="button" variant="ghost" onClick={() => { void signOut(); }} disabled={pending} className="h-10 w-full justify-start rounded-lg px-3 max-lg:h-11">
            <Icon icon="mingcute:arrow-left-line" data-icon="inline-start" aria-hidden="true" />
            {pending ? "正在退出…" : "退出登录"}
          </Button>
        </div>
        {error && <p role="alert" className="px-3 py-2 text-xs leading-relaxed text-destructive">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
