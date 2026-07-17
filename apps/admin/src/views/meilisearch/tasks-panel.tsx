import type { MeilisearchTask } from "~/api/meilisearch";
import type { DataTableColumns } from "naive-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Ban, Eye, RefreshCw } from "lucide-vue-next";
import { NButton, NDataTable, NDrawer, NDrawerContent, NSelect, NSpace, NTag } from "naive-ui";
import { defineComponent, h, ref } from "vue";
import { toast } from "vue-sonner";

import { meilisearchApi } from "~/api/meilisearch";

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "等待中", value: "enqueued" },
  { label: "处理中", value: "processing" },
  { label: "成功", value: "succeeded" },
  { label: "失败", value: "failed" },
  { label: "已取消", value: "canceled" },
];

/** 将 Meilisearch 任务状态映射到标签类型。 */
const statusType = (status: MeilisearchTask["status"]): "success" | "error" | "warning" | "default" => {
  if (status === "succeeded")
    return "success";
  if (status === "failed")
    return "error";
  if (status === "enqueued" || status === "processing")
    return "warning";
  return "default";
};

/** Meilisearch 原生异步任务队列面板。 */
export const MeilisearchTasksPanel = defineComponent({
  name: "MeilisearchTasksPanel",
  setup() {
    const queryClient = useQueryClient();
    const status = ref("");
    const selectedTask = ref<MeilisearchTask>();
    const drawerOpen = ref(false);

    const tasksQuery = useQuery({
      queryKey: ["meilisearch", "tasks", status],
      queryFn: () => meilisearchApi.getTasks(status.value),
      refetchInterval: 3_000,
    });
    const cancelMutation = useMutation({
      mutationFn: (uid: number) => meilisearchApi.cancelTasks(String(uid)),
      onSuccess: () => {
        toast.success("取消请求已提交");
        queryClient.invalidateQueries({ queryKey: ["meilisearch", "tasks"] });
      },
    });

    /** 打开任务原始详情抽屉。 */
    const showTask = (task: MeilisearchTask): void => {
      selectedTask.value = task;
      drawerOpen.value = true;
    };

    const columns: DataTableColumns<MeilisearchTask> = [
      { title: "UID", key: "uid", width: 80 },
      { title: "类型", key: "type", ellipsis: { tooltip: true } },
      { title: "索引", key: "indexUid", render: row => row.indexUid ?? "—" },
      {
        title: "状态",
        key: "status",
        width: 110,
        render: row => h(NTag, { size: "small", type: statusType(row.status) }, { default: () => row.status }),
      },
      { title: "耗时", key: "duration", render: row => row.duration ?? "—" },
      { title: "入队时间", key: "enqueuedAt", render: row => new Date(row.enqueuedAt).toLocaleString() },
      {
        title: "操作",
        key: "actions",
        width: 110,
        render: row => h(NSpace, { size: 4 }, {
          default: () => [
            h(NButton, { quaternary: true, size: "small", class: "cursor-pointer", onClick: () => showTask(row) }, { icon: () => h(Eye) }),
            ...(row.status === "enqueued" || row.status === "processing"
              ? [h(NButton, {
                  quaternary: true,
                  size: "small",
                  type: "warning",
                  class: "cursor-pointer",
                  loading: cancelMutation.isPending.value,
                  onClick: () => cancelMutation.mutate(row.uid),
                }, { icon: () => h(Ban) })]
              : []),
          ],
        }),
      },
    ];

    return () => (
      <div class="space-y-4">
        <div class="flex justify-between gap-3">
          <NSelect
            class="max-w-56"
            value={status.value}
            options={statusOptions}
            onUpdateValue={value => status.value = value}
          />
          <NButton class="cursor-pointer" secondary onClick={() => tasksQuery.refetch()}>
            {{ icon: () => <RefreshCw />, default: () => "刷新" }}
          </NButton>
        </div>
        <NDataTable
          loading={tasksQuery.isPending.value}
          columns={columns}
          data={tasksQuery.data.value?.results ?? []}
          rowKey={row => row.uid}
          scrollX={980}
        />

        <NDrawer show={drawerOpen.value} onUpdateShow={value => drawerOpen.value = value} width="min(680px, 92vw)">
          <NDrawerContent title={`任务 #${selectedTask.value?.uid ?? ""}`} closable>
            <pre class="text-xs whitespace-pre-wrap break-all">{JSON.stringify(selectedTask.value, null, 2)}</pre>
          </NDrawerContent>
        </NDrawer>
      </div>
    );
  },
});
