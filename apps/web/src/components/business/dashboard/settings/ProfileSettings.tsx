"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/lib/inline-icon";
import { ProfileFields } from "./ProfileFields";
import { ProfileSettingsSkeleton } from "./ProfileSettingsSkeleton";
import { ProfileSocialLinks } from "./ProfileSocialLinks";
import { useProfileSettings } from "./useProfileSettings";

/** 用户资料单页；设置分组仅由工作区外侧导航维护。 */
export function ProfileSettings() {
  const profile = useProfileSettings();
  const busy = profile.pending || profile.awaitingRefresh;
  return (
      <form aria-label="用户设置" aria-busy={profile.loading || profile.pending} className="flex h-full min-h-0 min-w-0 flex-col" onSubmit={(event) => { event.preventDefault(); void profile.save(); }} onReset={(event) => { event.preventDefault(); profile.reset(); }}>
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <h2 className="flex items-center gap-2 text-sm font-medium"><Icon icon="mingcute:user-3-line" className="size-4" aria-hidden="true" />用户</h2>
          <div className="flex items-center gap-2">
            {profile.canReset && <Button type="reset" variant="ghost" size="sm" disabled={busy}>取消</Button>}
            {profile.loading ? <Skeleton aria-hidden="true" className="h-8 w-20 rounded-xl" /> : <Button type="submit" size="sm" disabled={!profile.dirty || busy}><Icon icon="mingcute:check-line" data-icon="inline-start" aria-hidden="true" />{profile.pending ? "保存中…" : "保存"}</Button>}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <FieldGroup className="mx-auto max-w-3xl gap-8 p-5 lg:p-6">
            {profile.loadError && !profile.saveError && <Alert variant="destructive"><AlertTitle>无法读取最新资料</AlertTitle><AlertDescription><p>{profile.loadError}</p><Button type="button" variant="outline" size="sm" disabled={profile.pending} onClick={() => { void profile.retry(); }}>重试读取</Button></AlertDescription></Alert>}
            {profile.saveError && <Alert variant="destructive"><AlertTitle>{profile.awaitingRefresh ? "已保存，等待确认最新资料" : "保存失败"}</AlertTitle><AlertDescription><p>{profile.saveError}</p>{profile.awaitingRefresh && <Button type="button" variant="outline" size="sm" disabled={profile.pending} onClick={() => { void profile.retry(); }}>重新读取已保存资料</Button>}</AlertDescription></Alert>}
            {profile.success && <Alert role="status"><AlertTitle>保存成功</AlertTitle><AlertDescription>{profile.success}</AlertDescription></Alert>}
            {profile.draft ? <>
              <ProfileFields draft={profile.draft} disabled={busy} onBasicChange={(key, value) => profile.change("basic", key, value)} />
              <ProfileSocialLinks draft={profile.draft} disabled={busy} onEntriesChange={profile.changeSocialEntries} />
              {profile.dirty && <p role="status" className="text-xs text-muted-foreground">有尚未保存的修改</p>}
            </> : profile.loading && <ProfileSettingsSkeleton />}
          </FieldGroup>
        </div>
      </form>
  );
}
