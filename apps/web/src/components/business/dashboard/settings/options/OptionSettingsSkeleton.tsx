import { Skeleton } from "@/components/ui/skeleton";
import type { OptionGroup } from "./option-schema";

/** 按实际分组与控件占位，避免长邮件表单和列表配置加载后跳动。 */
export function OptionSettingsSkeleton({ group }: { group: OptionGroup }) {
  return <div role="status" aria-label={`正在读取${group.title}`} className="flex flex-col gap-8">
    <span className="sr-only">正在读取{group.title}…</span>
    <Skeleton aria-hidden="true" className="h-4 w-full max-w-96" />
    {group.sections.map(section => <div key={section.title} aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-lg" /><Skeleton className="h-4 w-28" /></div>
      {section.fields.map(field => field.type === "object-list" ? <Skeleton key={field.path} className="h-40 w-full" /> : <div key={field.path} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-8"><Skeleton className="h-4 w-28 lg:w-1/3" /><Skeleton className={field.type === "textarea" || field.type === "lines" ? "h-24 w-full lg:flex-1" : "h-9 w-full lg:flex-1"} /></div>)}
    </div>)}
  </div>;
}
