"use client";

import { useEffect, useRef, useState } from "react";
import type { OptionDocument, OptionValue } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { testDashboardProxy } from "@/lib/dashboard-options";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { composeProxyUrl, splitProxyUrl, updateProxyAddress, type ProxyParts } from "./network-model";
import { SecretInput } from "./settings-inputs";
import { failureMessage, type SettingsIssue } from "./settings-model";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";

interface NetworkSettingsProps {
  document: OptionDocument;
  disabled: boolean;
  issues: readonly SettingsIssue[];
  onChange: (path: string, value: OptionValue | undefined) => void;
}

interface ProbeStatus {
  ok: boolean;
  message: string;
}

/** 代理地址与凭据分开编辑，后端仍保存为单个带 userinfo 的 proxyUrl。 */
export function NetworkSettings({ document, disabled, issues, onChange }: NetworkSettingsProps) {
  const proxyUrl = typeof document.proxyUrl === "string" ? document.proxyUrl : "";
  const [parts, setParts] = useState<ProxyParts>(() => splitProxyUrl(proxyUrl));
  const [pending, setPending] = useState(false);
  const [probe, setProbe] = useState<ProbeStatus | null>(null);
  const inFlight = useRef(false);
  const written = useRef(proxyUrl);
  const error = issues.find(issue => issue.path === "proxyUrl")?.message;

  /** 外部重置或保存回读改变 proxyUrl 时才覆盖本地输入。 */
  useEffect(() => {
    if (proxyUrl === written.current) return;
    written.current = proxyUrl;
    setParts(splitProxyUrl(proxyUrl));
  }, [proxyUrl]);

  /** 合并三个输入为一个后端 proxyUrl，并同步草稿。 */
  function write(next: ProxyParts) {
    const composed = composeProxyUrl(next);
    setParts(next);
    written.current = composed;
    setProbe(null);
    onChange("proxyUrl", composed);
  }

  /** 粘贴完整地址时把内嵌凭据移到独立字段，避免密码明文留在地址框。 */
  function updateAddress(value: string) {
    write(updateProxyAddress(value, parts));
  }

  /** 使用当前草稿测试，不要求先保存或重启后端。 */
  async function test() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setPending(true);
    setProbe(null);
    try {
      const result = await testDashboardProxy(composeProxyUrl(parts));
      if (result.status === 407) {
        setProbe({ ok: false, message: "代理要求认证（HTTP 407），请检查用户名和密码。" });
      } else if (result.status >= 200 && result.status < 400) {
        setProbe({ ok: true, message: `${result.proxied ? "代理" : "直连"}连接正常 · HTTP ${result.status} · ${result.latencyMs} ms` });
      } else {
        setProbe({ ok: false, message: `已连接代理，但测试目标返回 HTTP ${result.status}。` });
      }
    } catch (cause) {
      setProbe({ ok: false, message: `测试失败：${failureMessage(cause)}` });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <SettingsSection
      title="代理服务器"
      icon="mingcute:earth-line"
      description="支持 HTTP、HTTPS 与 SOCKS5；保存后重启后端服务生效。"
      action={(
        <Button type="button" variant="outline" size="sm" disabled={disabled || pending} aria-busy={pending} onClick={() => { void test(); }}>
          {pending ? "正在测试…" : "测试连接"}
        </Button>
      )}
    >
      <SettingsRow id="network-proxy-address" controlId="network-proxy-address" path="proxyUrl" label="代理地址" hint="填写协议、主机和端口，例如 http://127.0.0.1:7890；留空表示直连。" error={error}>
        <Input
          id="network-proxy-address"
          value={parts.address}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby="network-proxy-address-hint"
          placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          onChange={event => updateAddress(event.target.value)}
        />
      </SettingsRow>
      <SettingsRow id="network-proxy-username" controlId="network-proxy-username" path="proxyUrl.username" label="代理用户名" hint="代理服务器要求认证时填写；SOCKS5 必须同时填写用户名和密码。">
        <Input
          id="network-proxy-username"
          value={parts.username}
          disabled={disabled}
          aria-describedby="network-proxy-username-hint"
          placeholder="可选"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          onChange={event => write({ ...parts, username: event.target.value })}
        />
      </SettingsRow>
      <SettingsRow id="network-proxy-password" controlId="network-proxy-password" path="proxyUrl.password" label="代理密码" hint="仅保存在 Owner 配置中，不会出现在公开接口或测试提示里。">
        <SecretInput
          id="network-proxy-password"
          value={parts.password}
          disabled={disabled}
          describedBy="network-proxy-password-hint"
          onChange={value => write({ ...parts, password: value })}
        />
      </SettingsRow>
      {probe && (
        <div role="status" aria-live="polite" className={cn("flex items-start gap-2 py-4 text-[0.8125rem] leading-relaxed", probe.ok ? "text-foreground" : "text-destructive")}>
          <Icon icon={probe.ok ? "mingcute:check-circle-line" : "mingcute:alert-line"} className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{probe.message}</span>
        </div>
      )}
    </SettingsSection>
  );
}
