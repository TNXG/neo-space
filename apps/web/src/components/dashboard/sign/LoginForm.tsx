"use client";

import type { DashboardLoginState } from "@/hooks/use-dashboard-login";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icons/inline-icon";
import { cn } from "@/lib/utils";

const INPUT_CLASS = "h-12 rounded-xl border-border bg-background/70 px-3.5 text-base backdrop-blur-sm transition-colors md:text-base";

/** 密码表单；自动 Passkey 失败后才提供低调的手动重试入口。 */
export function LoginForm({ login }: { login: DashboardLoginState }) {
  const busy = login.pending !== null;
  const matched = Boolean(login.profile);
  const showPassword = login.allow?.password !== false;

  return (
    <form onSubmit={(event) => { event.preventDefault(); void login.signIn("password"); }} aria-busy={busy}>
      <FieldGroup className="gap-5">
        <Field data-invalid={login.unmatched || Boolean(login.queryError)} data-disabled={busy}>
          <FieldLabel htmlFor="dashboard-identifier" className="cursor-pointer text-sm font-medium">用户名或邮箱</FieldLabel>
          <Input
            id="dashboard-identifier"
            name="username"
            className={INPUT_CLASS}
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
          <FieldLabel htmlFor="dashboard-password" className="cursor-pointer text-sm font-medium">密码</FieldLabel>
          <Input
            id="dashboard-password"
            name="password"
            className={INPUT_CLASS}
            type="password"
            autoComplete="current-password"
            placeholder="输入密码"
            value={login.password}
            onChange={event => login.setPassword(event.target.value)}
            disabled={busy || !showPassword}
            required={showPassword}
          />
        </Field>
        <Button
          type="submit"
          disabled={busy || !showPassword || !matched || !login.allow?.password || !login.password}
          className={cn("h-12 w-full cursor-pointer rounded-xl text-base font-medium", !showPassword && "hidden")}
          aria-hidden={!showPassword}
        >
          {login.pending === "password" ? "正在登录…" : "登录"}
          <Icon icon="mingcute:arrow-right-line" data-icon="inline-end" aria-hidden="true" />
        </Button>
        {login.allow?.passkey && login.passkeyError && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy || login.passkeyPending}
              onClick={() => { void login.signIn("passkey"); }}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="重试通行密钥"
              title="重试通行密钥"
            >
              <Icon icon="mingcute:key-2-line" aria-hidden="true" />
            </Button>
          </div>
        )}
      </FieldGroup>
    </form>
  );
}
