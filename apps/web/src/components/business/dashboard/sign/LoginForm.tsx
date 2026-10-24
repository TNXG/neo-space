"use client";

import type { DashboardLoginState } from "@/hooks/use-dashboard-login";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

/** 密码表单；自动 Passkey 失败后才提供低调的手动重试入口。 */
export function LoginForm({ login }: { login: DashboardLoginState }) {
  const busy = login.pending !== null;
  const matched = Boolean(login.profile);
  const showPassword = login.allow?.password !== false;

  return (
    <form onSubmit={(event) => { event.preventDefault(); void login.signIn("password"); }} aria-busy={busy}>
      <FieldGroup className="gap-3">
        <Field data-invalid={login.unmatched || Boolean(login.queryError)} data-disabled={busy}>
          <FieldLabel htmlFor="dashboard-identifier" className="cursor-pointer">用户名<span aria-hidden="true" className="ml-auto font-mono text-[0.625rem] tracking-widest text-muted-foreground">IDENTITY</span></FieldLabel>
          <Input
            id="dashboard-identifier"
            name="username"
            className="h-12 rounded-lg"
            autoComplete="username webauthn"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="用户名或邮箱"
            value={login.identifier}
            onChange={event => login.changeIdentifier(event.target.value)}
            disabled={busy}
            aria-invalid={login.unmatched || Boolean(login.queryError)}
            aria-describedby="dashboard-identity-status"
            required
          />
        </Field>
        <Field data-disabled={busy || !showPassword} aria-hidden={!showPassword} className={cn(!showPassword && "hidden")}>
          <FieldLabel htmlFor="dashboard-password" className="cursor-pointer">密码<span aria-hidden="true" className="ml-auto font-mono text-[0.625rem] tracking-widest text-muted-foreground">SECRET KEY</span></FieldLabel>
          <Input
            id="dashboard-password"
            name="password"
            className="h-12 rounded-lg"
            type="password"
            autoComplete="current-password"
            placeholder="输入密码"
            value={login.password}
            onChange={event => login.setPassword(event.target.value)}
            disabled={busy || !showPassword}
            required={showPassword}
          />
        </Field>
        <Button type="submit" disabled={busy || !showPassword || !matched || !login.allow?.password || !login.password} className={cn("h-12 w-full cursor-pointer rounded-lg", !showPassword && "hidden")} aria-hidden={!showPassword}>
          {login.pending === "password" ? "正在登录…" : "登录"}
          <Icon icon="mingcute:arrow-right-line" data-icon="inline-end" aria-hidden="true" />
        </Button>
        {login.allow?.passkey && login.passkeyError && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="icon-sm" disabled={busy || login.passkeyPending} onClick={() => { void login.signIn("passkey"); }} className="cursor-pointer text-muted-foreground" aria-label="重试通行密钥" title="重试通行密钥">
              <Icon icon="mingcute:key-2-line" aria-hidden="true" />
            </Button>
          </div>
        )}
      </FieldGroup>
    </form>
  );
}
