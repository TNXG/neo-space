"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useDashboardLogin } from "@/hooks/use-dashboard-login";
import { useDashboardSession } from "@/hooks/use-dashboard-session";
import { Icon } from "@/lib/inline-icon";
import { useRouter } from "@/locales/navigation";
import { LoginForm } from "./LoginForm";
import { OwnerIdentity } from "./OwnerIdentity";
import { ObservatoryScene } from "./ObservatoryScene";

interface LoginPanelProps {
  initialError?: string;
}

/** 星海观测站入口；视觉与认证状态分离，沿用密码和 Passkey 流程。 */
export function LoginPanel({ initialError }: LoginPanelProps) {
  const login = useDashboardLogin(initialError);
  const session = useDashboardSession();
  const router = useRouter();
  useEffect(() => {
    if (login.user) router.replace("/dashboard");
  }, [login.user, router]);
  const message = login.error || login.queryError || login.optionsError || login.passkeyError || (session.error ? "暂时无法验证会话，请检查后台连接。" : "");

  return (
    <div className="observatory-composition grid w-full items-center gap-3 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <ObservatoryScene />
      <section aria-labelledby="dashboard-login-title" className="observatory-panel relative mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border p-5 sm:p-7">
        <div aria-hidden="true" className="absolute -top-px left-8 h-px w-16 bg-primary" />
        <div className="flex items-center justify-between font-mono text-[0.625rem] tracking-[0.2em] text-muted-foreground">
          <span>ACCESS TERMINAL</span>
        </div>
        <div className="flex flex-col gap-2">
          <h2 id="dashboard-login-title" className="text-2xl font-medium tracking-tight">{login.user ? "欢迎归航" : "连接你的宇宙"}</h2>
          <p className="text-sm text-muted-foreground">{login.user ? "身份已确认，你已回到自己的空间。" : "登录后台，让新的灵感在这里发生。"}</p>
        </div>
        {!login.user && <OwnerIdentity profile={login.profile} identifying={login.identifying} unmatched={login.unmatched} />}
        {login.user ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Icon icon="mingcute:check-line" aria-hidden="true" />登录成功，正在进入工作区…
          </p>
        ) : <LoginForm login={login} />}
        <div className="flex min-h-4 flex-col gap-1">
          {message && <p role="alert" className="text-sm leading-6 text-destructive">{message}</p>}
          {!login.user && (login.queryError || login.optionsError) && (
            <Button variant="link" size="sm" className="w-fit cursor-pointer px-0" onClick={login.retry}>重试</Button>
          )}
        </div>
        <p className="flex items-center justify-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Icon icon="mingcute:lock-line" aria-hidden="true" />仅向空间主人开放
        </p>
      </section>
    </div>
  );
}
