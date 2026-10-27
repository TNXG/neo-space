import { Skeleton } from "@/components/ui/skeleton";

/** 预留头像概览、资料行与社交区的真实密度。 */
export function ProfileSkeleton() {
  return (
    <div role="status" aria-label="正在读取用户资料" className="flex flex-col gap-6">
      <span className="sr-only">正在读取用户资料…</span>
      <div aria-hidden="true" className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
      </div>
      {["基本信息", "社交链接"].map(section => (
        <div key={section} aria-hidden="true" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <div className="divide-y divide-border/50 rounded-xl border border-border px-4">
            {[0, 1, 2].map(row => (
              <div key={row} className="flex min-h-16 flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full lg:w-72" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
