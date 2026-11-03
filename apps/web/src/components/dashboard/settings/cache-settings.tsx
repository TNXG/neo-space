"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearDashboardResponseCache } from "@/lib/dashboard-api";
import { failureMessage } from "./settings-model";
import { SettingsSection } from "./settings-section";

/** 即时维护操作独立于配置草稿；清除缓存不会保存、重置或重新读取表单。 */
export function CacheSettings({ index }: { index: number }) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  /** 执行独立维护请求，保留当前设置草稿并反馈后端错误。 */
  async function clearCache() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await clearDashboardResponseCache();
      toast.success("当前进程的 API 响应缓存已清除");
    } catch (cause) {
      toast.error(`清除缓存失败：${failureMessage(cause)}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <SettingsSection title="公开内容缓存" description="公开 API 的匿名读取使用服务端内存缓存，减少重复查询。" index={index}>
      <div className="flex flex-col items-start gap-4 py-4 lg:py-5">
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <p>缓存最长保留 5 分钟，连续 1 分钟未访问会自动过期；内容保存或删除后自动失效，通常无需手动清除。</p>
          <p>手动操作仅清除当前 Rust 进程的公开 API 响应缓存，不影响 CDN、浏览器缓存、登录凭据、邮件验证码、Passkey 挑战及友链健康检查和订阅源缓存。多进程部署需分别清除。</p>
          <p>此操作不会保存或丢弃当前页面尚未保存的配置。</p>
        </div>
        <Button type="button" variant="outline" disabled={pending} aria-busy={pending} onClick={() => { void clearCache(); }}>
          {pending ? "正在清除…" : "清除 API 响应缓存"}
        </Button>
      </div>
    </SettingsSection>
  );
}
