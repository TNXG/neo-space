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
      toast.success("内容缓存已刷新");
    } catch (cause) {
      toast.error(`清除缓存失败：${failureMessage(cause)}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <SettingsSection title="访问缓存" icon="mingcute:refresh-2-line" description="网站会自动缓存公开内容以加快访问速度，发布或修改内容后会自动更新。" index={index}>
      <div className="flex flex-col items-start justify-between gap-4 py-4 sm:flex-row sm:items-center lg:py-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          如果前台页面没有及时显示最新内容，可以手动刷新缓存。此操作不会影响当前页面尚未保存的设置。
        </p>
        <Button type="button" variant="outline" className="shrink-0" disabled={pending} aria-busy={pending} onClick={() => { void clearCache(); }}>
          {pending ? "正在刷新…" : "刷新内容缓存"}
        </Button>
      </div>
    </SettingsSection>
  );
}
