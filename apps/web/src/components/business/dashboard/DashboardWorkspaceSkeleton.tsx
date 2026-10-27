import { Skeleton } from "@/components/ui/skeleton";
import { ProfileSkeleton } from "./settings/profile-skeleton";
import { findSettingGroup } from "./settings/settings-groups";
import { SettingsSkeleton } from "./settings/settings-skeleton";

/** 会话建立前保持工作区比例；设置路由同时预留资料布局。 */
export function DashboardWorkspaceSkeleton({ settings, groupSlug }: { settings: boolean; groupSlug?: string }) {
  const group = groupSlug ? findSettingGroup(groupSlug) : undefined;
  return (
    <main role="status" aria-label="正在验证会话" aria-busy="true" className="flex h-svh overflow-hidden bg-muted">
      <span className="sr-only">正在验证会话…</span>
      <div aria-hidden="true" className="hidden w-61 shrink-0 flex-col gap-5 px-3 py-4 lg:flex">
        <div className="flex items-center gap-3 px-2"><Skeleton className="size-7 shrink-0 rounded-lg" /><Skeleton className="h-4 flex-1" /><Skeleton className="size-4" /></div>
        <div className="flex flex-col gap-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-8 w-full" />)}</div>
        <div className="mt-auto flex items-center gap-3 px-2 pb-3"><Skeleton className="size-10 shrink-0 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-2/3" /></div></div>
      </div>
      <div aria-hidden="true" className="my-2 mr-2 ml-1.5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border/50 px-4"><Skeleton className="size-7 rounded-lg" /><Skeleton className="h-4 w-20" /></div>
        {settings && <>
          <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-border px-4 lg:px-6"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-24 rounded-lg" /></div>
          <div className="min-h-0 flex-1 overflow-hidden"><div className="mx-auto max-w-4xl p-4 lg:p-6">{group ? <SettingsSkeleton group={group} /> : <ProfileSkeleton />}</div></div>
        </>}
      </div>
    </main>
  );
}
