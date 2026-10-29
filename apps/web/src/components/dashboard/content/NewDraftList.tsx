"use client";

import type { ContentKind } from "./content-model";
import { toast } from "sonner";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { dashboardNewDraftsKey, deleteDashboardDraft, getDashboardNewDrafts } from "@/lib/dashboard-content";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 尚未创建正式内容的服务端草稿；没有时不占位。
 * @param props 内容类型
 * @returns 草稿列表
 */
export function NewDraftList({ kind }: { kind: ContentKind }) {
  const drafts = useSWR(dashboardNewDraftsKey(kind), () => getDashboardNewDrafts(kind));
  const base = kind === "post" ? "/dashboard/posts" : "/dashboard/pages";
  if (!drafts.data?.length) return null;

  const remove = async (_id: string) => {
    try {
      await drafts.mutate(async (current) => {
        await deleteDashboardDraft(_id);
        return current?.filter(item => item._id !== _id);
      }, { optimisticData: current => current?.filter(item => item._id !== _id) ?? [], rollbackOnError: true, revalidate: false });
      toast.success("草稿已删除");
    } catch (error) {
      toast.error(error instanceof Error ? `删除失败：${error.message}` : "删除失败");
    }
  };

  return (
    <section aria-labelledby={`${kind}-new-drafts`} className="flex flex-col gap-1.5">
      <h3 id={`${kind}-new-drafts`} className="flex items-center gap-2 px-1 text-[0.8125rem] font-semibold">
        <Icon icon="mingcute:edit-2-line" className="size-4 text-primary" aria-hidden="true" />
        继续写
        <span className="font-normal text-muted-foreground tabular-nums">{drafts.data.length}</span>
      </h3>
      <ul className="flex flex-col gap-0.5 rounded-xl border border-dashed border-primary/30 bg-primary/3 p-1">
        {drafts.data.map(draft => (
          <li key={draft._id} className="group/row relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-(--motion-duration-fast) hover:bg-primary/6">
            <Link href={`${base}/new?draft=${draft._id}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring">
              <span className="truncate text-sm">{draft.title?.trim() || "无标题草稿"}</span>
              <Badge variant="outline" className="shrink-0">新草稿</Badge>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{dateFormat.format(new Date(draft.updated ?? draft.created))}</span>
            </Link>
            <div className="relative z-10">
              <ConfirmDeleteButton label="草稿" onConfirm={() => remove(draft._id)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
