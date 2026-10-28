"use client";

import useSWR from "swr";
import type { DashboardOptions, OptionDocument, OptionValue } from "@/types/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { DASHBOARD_OPTIONS_KEY, getDashboardOptions } from "@/lib/dashboard-options";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { cn } from "@/lib/utils";
import { SettingsField } from "./settings-field";
import { CopyField } from "./settings-inputs";
import { isDocument, readValue, type SettingsIssue } from "./settings-model";
import type { SettingGroup } from "./settings-schema";
import { SettingsSection } from "./settings-section";

const PROVIDERS = [
  { type: "github", name: "GitHub", icon: "mingcute:github-line", description: "访客使用 GitHub 账号登录评论。需要在 GitHub 创建 OAuth App。" },
  { type: "qq", name: "QQ", icon: "mingcute:qq-line", description: "通过既定中转服务登录，无需在此填写凭据。" },
] as const;

interface OAuthSettingsProps {
  group: SettingGroup;
  document: OptionDocument;
  disabled: boolean;
  issues: readonly SettingsIssue[];
  onChange: (path: string, value: OptionValue | undefined) => void;
}

/** 第三方登录：提供商固定，按卡片展示可见性与所需配置，不再让用户手动"添加类型"。 */
export function OAuthSettings({ group, document, disabled, issues, onChange }: OAuthSettingsProps) {
  const { data: options } = useSWR<DashboardOptions>(DASHBOARD_OPTIONS_KEY, getDashboardOptions, { shouldRetryOnError: false });
  const entries = Array.isArray(document.providers) ? document.providers.filter(isDocument) : [];
  const serverUrl = options?.url ? readValue(options.url, "serverUrl") : undefined;
  const callback = typeof serverUrl === "string" && serverUrl.trim() ? `${serverUrl.trim().replace(/\/$/, "")}/api/auth/oauth/github/callback` : "";
  const githubFields = group.sections.find(section => section.title === "GitHub 登录")?.fields ?? [];

  /** 切换公开标记；列表中缺少该类型时补上条目，其余字段原样保留。 */
  function setEnabled(type: string, enabled: boolean) {
    const exists = entries.some(entry => entry.type === type);
    onChange("providers", exists ? entries.map(entry => entry.type === type ? { ...entry, enabled } : entry) : [...entries, { type, enabled }]);
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection title="登录方式" icon="mingcute:user-3-line" description="开关决定评论区是否显示对应的登录入口，不会阻止已有的回调请求。" framed={false}>
        <div className="flex flex-col gap-3">
          {PROVIDERS.map(provider => {
            const enabled = entries.some(entry => entry.type === provider.type && entry.enabled === true);
            const id = `oauth-${provider.type}-enabled`;
            return (
              <div key={provider.type} data-path="providers" className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
                <div className="flex items-start gap-3.5 px-4 py-4 lg:px-5">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 transition-colors duration-[var(--motion-duration-fast)]", enabled ? "bg-foreground text-background" : "bg-muted text-muted-foreground")} aria-hidden="true">
                    <Icon icon={provider.icon} className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <FieldLabel htmlFor={id} className="cursor-pointer text-sm font-semibold">{provider.name}</FieldLabel>
                      <Badge variant={enabled ? "secondary" : "outline"}>{enabled ? "评论区可见" : "已隐藏"}</Badge>
                    </div>
                    <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{provider.description}</p>
                  </div>
                  <Switch id={id} checked={enabled} disabled={disabled} className="mt-1" onCheckedChange={next => setEnabled(provider.type, next)} />
                </div>

                {provider.type === "github" && (
                  <div className="flex flex-col divide-y divide-border/60 border-t border-border/60 bg-muted/30 px-4 lg:px-5">
                    <Field className="gap-2 py-4">
                      <FieldLabel htmlFor="oauth-github-callback" className="text-sm font-medium">回调地址</FieldLabel>
                      {callback ? (
                        <>
                          <CopyField id="oauth-github-callback" value={callback} label="回调地址" />
                          <FieldDescription className="text-[0.8125rem]">复制到 GitHub OAuth App 的 Authorization callback URL。</FieldDescription>
                        </>
                      ) : (
                        <Alert>
                          <Icon icon="mingcute:information-line" aria-hidden="true" />
                          <AlertDescription>
                            尚未设置服务端地址，无法生成回调地址。
                            <Link href="/dashboard/settings/url" className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline">前往地址设置</Link>
                          </AlertDescription>
                        </Alert>
                      )}
                    </Field>
                    {githubFields.map(field => (
                      <SettingsField
                        key={field.path}
                        field={field}
                        document={document}
                        root={document}
                        relative={field.path}
                        path={field.path}
                        id={`setting-oauth-${field.path}`.replaceAll(".", "-")}
                        disabled={disabled}
                        issues={issues}
                        onChange={onChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
}
