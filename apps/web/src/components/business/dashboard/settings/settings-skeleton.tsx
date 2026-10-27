import { Skeleton } from "@/components/ui/skeleton";
import type { SettingGroup } from "./settings-schema";

/** 按真实字段类型占位，加载完成后不产生明显跳动。 */
export function SettingsSkeleton({ group }: { group: SettingGroup }) {
  return (
    <div role="status" aria-label={`正在读取${group.title}`} className="flex flex-col gap-6">
      <span className="sr-only">正在读取{group.title}…</span>
      {group.sections.map(section => (
        <div key={section.title} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <div className="divide-y divide-border/50 rounded-xl border border-border px-4">
            {section.fields.map(field => (
              <div key={field.path} className="flex min-h-16 flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className={field.control === "switch" ? "h-5 w-9 shrink-0 rounded-full" : field.control === "number" ? "h-9 w-28 shrink-0" : field.control === "collection" || field.control === "list" || field.control === "tags" ? "h-20 w-full lg:w-72" : "h-9 w-full lg:w-72"} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
