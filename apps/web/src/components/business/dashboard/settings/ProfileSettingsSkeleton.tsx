import { Skeleton } from "@/components/ui/skeleton";

/** 预留头像概览、六行基本资料和社交区的真实布局，不生成可交互表单。 */
export function ProfileSettingsSkeleton() {
  return (
    <div role="status" aria-label="正在读取用户资料" className="flex flex-col gap-8">
      <span className="sr-only">正在读取用户资料…</span>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex items-center gap-5 pb-2">
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-3"><Skeleton className="h-5 w-32 max-w-full" /><Skeleton className="h-4 w-24 max-w-full" /><Skeleton className="h-3 w-44 max-w-full" /></div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-lg" /><Skeleton className="h-4 w-20" /></div>
          <div className="divide-y divide-border/40 border-y border-border/60">
            {["name", "handle", "email", "url", "introduce", "image"].map((field) => (
              <div key={field} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:gap-8">
                <div className="flex flex-col gap-2 lg:w-1/3 lg:max-w-56 lg:shrink-0"><Skeleton className="h-4 w-16" />{(field === "email" || field === "image") && <Skeleton className="h-3 w-full max-w-52" />}</div>
                <Skeleton className={field === "introduce" ? "h-24 w-full lg:flex-1" : "h-9 w-full lg:flex-1"} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-lg" /><Skeleton className="h-4 w-20" /><Skeleton className="ml-auto h-8 w-16" /></div>
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
