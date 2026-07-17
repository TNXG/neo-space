import type { SearchMaintenanceTask, SearchSyncEvent } from "~/api/meilisearch";
import type { DataTableColumns } from "naive-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Ban, Eye, Play, RotateCcw, Save } from "lucide-vue-next";
import {
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NInputNumber,
  NPopconfirm,
  NProgress,
  NSpace,
  NSwitch,
  NTag,
} from "naive-ui";
import { defineComponent, h, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { meilisearchApi } from "~/api/meilisearch";

/** 映射后台维护状态为 Naive UI 标签类型。 */
const maintenanceStatusType = (status: SearchMaintenanceTask["status"]): "success" | "error" | "warning" | "default" => {
  if (status === "succeeded")
    return "success";
  if (status === "failed")
    return "error";
  if (status === "queued" || status === "running")
    return "warning";
  return "default";
};

/** 索引蓝绿重建、日志、重试、取消与定时计划面板。 */
export const MeilisearchMaintenancePanel = defineComponent({
  name: "MeilisearchMaintenancePanel",
  setup() {
    const queryClient = useQueryClient();
    const scheduleEnabled = ref(false);
    const intervalHours = ref(24);
    const selectedTask = ref<SearchMaintenanceTask>();
    const logDrawerOpen = ref(false);

    const tasksQuery = useQuery({
      queryKey: ["meilisearch", "maintenance", "tasks"],
      queryFn: meilisearchApi.getMaintenanceTasks,
      refetchInterval: 2_000,
    });
    const scheduleQuery = useQuery({
      queryKey: ["meilisearch", "maintenance", "schedule"],
      queryFn: meilisearchApi.getSchedule,
    });
    const syncEventsQuery = useQuery({
      queryKey: ["meilisearch", "maintenance", "sync-events"],
      queryFn: meilisearchApi.getSyncEvents,
      refetchInterval: 3_000,
    });
    watch(() => scheduleQuery.data.value, (schedule) => {
      if (!schedule)
        return;
      scheduleEnabled.value = schedule.enabled;
      intervalHours.value = schedule.intervalHours;
    }, { immediate: true });

    /** 刷新维护任务列表。 */
    const refreshTasks = (): void => {
      queryClient.invalidateQueries({ queryKey: ["meilisearch", "maintenance", "tasks"] });
    };

    const rebuildMutation = useMutation({
      mutationFn: meilisearchApi.createRebuild,
      onSuccess: () => {
        toast.success("索引重建任务已创建");
        refreshTasks();
      },
    });
    const retryMutation = useMutation({
      mutationFn: meilisearchApi.retryRebuild,
      onSuccess: () => {
        toast.success("失败任务已重新入队");
        refreshTasks();
      },
    });
    const cancelMutation = useMutation({
      mutationFn: meilisearchApi.cancelRebuild,
      onSuccess: () => {
        toast.success("取消请求已记录，将在安全阶段停止");
        refreshTasks();
      },
    });
    const scheduleMutation = useMutation({
      mutationFn: () => meilisearchApi.updateSchedule(scheduleEnabled.value, intervalHours.value),
      onSuccess: (schedule) => {
        toast.success("定时维护计划已保存");
        queryClient.setQueryData(["meilisearch", "maintenance", "schedule"], schedule);
      },
    });
    const retrySyncMutation = useMutation({
      mutationFn: meilisearchApi.retrySyncEvent,
      onSuccess: () => {
        toast.success("增量同步事件已立即重新入队");
        queryClient.invalidateQueries({ queryKey: ["meilisearch", "maintenance", "sync-events"] });
      },
    });

    /** 打开任务日志抽屉。 */
    const showLogs = (task: SearchMaintenanceTask): void => {
      selectedTask.value = task;
      logDrawerOpen.value = true;
    };

    const columns: DataTableColumns<SearchMaintenanceTask> = [
      { title: "任务", key: "_id", width: 120, render: row => row._id.slice(-8) },
      {
        title: "状态",
        key: "status",
        width: 100,
        render: row => h(NTag, { size: "small", type: maintenanceStatusType(row.status) }, { default: () => row.status }),
      },
      { title: "阶段", key: "phase", width: 140 },
      {
        title: "进度",
        key: "progress",
        width: 180,
        render: row => h(NProgress, { percentage: row.progress, status: row.status === "failed" ? "error" : "default" }),
      },
      { title: "来源", key: "scheduled", width: 90, render: row => row.scheduled ? "定时" : "手动" },
      { title: "创建时间", key: "createdAt", render: row => new Date(row.createdAt).toLocaleString() },
      {
        title: "操作",
        key: "actions",
        width: 150,
        render: row => h(NSpace, { size: 4 }, {
          default: () => [
            h(NButton, { quaternary: true, size: "small", class: "cursor-pointer", onClick: () => showLogs(row) }, { icon: () => h(Eye) }),
            ...(row.status === "failed" || row.status === "canceled"
              ? [h(NButton, { quaternary: true, size: "small", class: "cursor-pointer", onClick: () => retryMutation.mutate(row._id) }, { icon: () => h(RotateCcw) })]
              : []),
            ...(row.status === "queued" || row.status === "running"
              ? [h(NButton, { quaternary: true, size: "small", type: "warning", class: "cursor-pointer", onClick: () => cancelMutation.mutate(row._id) }, { icon: () => h(Ban) })]
              : []),
          ],
        }),
      },
    ];

    const syncColumns: DataTableColumns<SearchSyncEvent> = [
      { title: "事件", key: "_id", width: 110, render: row => row._id.slice(-8) },
      { title: "类型", key: "entityType", width: 90 },
      { title: "数据主键", key: "refId", ellipsis: { tooltip: true } },
      {
        title: "状态",
        key: "status",
        width: 105,
        render: row => h(NTag, {
          size: "small",
          type: row.status === "succeeded" ? "success" : row.status === "failed" ? "error" : "warning",
        }, { default: () => row.status }),
      },
      { title: "重试次数", key: "attempts", width: 95 },
      { title: "错误", key: "lastError", ellipsis: { tooltip: true }, render: row => row.lastError ?? "—" },
      {
        title: "操作",
        key: "actions",
        width: 80,
        render: row => row.status === "failed"
          ? h(NButton, {
              quaternary: true,
              size: "small",
              class: "cursor-pointer",
              onClick: () => retrySyncMutation.mutate(row._id),
            }, { icon: () => h(RotateCcw) })
          : "—",
      },
    ];

    return () => (
      <div class="space-y-5">
        <section class="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <NCard title="手动维护">
            <p class="text-sm opacity-60 mb-4">
              从 MongoDB 重新读取全部已发布文章、手记及翻译，生成搜索文档并在临时索引中完成向量化；配置和内容全部成功后再统一原子交换。
            </p>
            <NPopconfirm onPositiveClick={() => rebuildMutation.mutate()}>
              {{
                trigger: () => (
                  <NButton class="cursor-pointer" type="primary" loading={rebuildMutation.isPending.value}>
                    {{ icon: () => <Play />, default: () => "同步数据库并重建搜索索引" }}
                  </NButton>
                ),
                default: () => "确认从 MongoDB 全量同步内容，并重新构建搜索与向量索引？",
              }}
            </NPopconfirm>
          </NCard>

          <NCard title="定时重建计划">
            <div class="flex flex-wrap gap-5 items-center">
              <div class="flex items-center gap-2">
                <NSwitch value={scheduleEnabled.value} onUpdateValue={value => scheduleEnabled.value = value} />
                <span>启用计划</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm opacity-60">每</span>
                <NInputNumber
                  value={intervalHours.value}
                  onUpdateValue={value => intervalHours.value = value ?? 24}
                  min={1}
                  max={8760}
                  class="w-32"
                />
                <span class="text-sm opacity-60">小时</span>
              </div>
              <NButton class="cursor-pointer" secondary loading={scheduleMutation.isPending.value} onClick={() => scheduleMutation.mutate()}>
                {{ icon: () => <Save />, default: () => "保存计划" }}
              </NButton>
            </div>
            <p class="text-xs opacity-60 mt-3">
              下次执行：{scheduleQuery.data.value?.nextRunAt ? new Date(scheduleQuery.data.value.nextRunAt).toLocaleString() : "未安排"}
            </p>
          </NCard>
        </section>

        <NCard title="重建任务与日志">
          <NDataTable
            loading={tasksQuery.isPending.value}
            columns={columns}
            data={tasksQuery.data.value ?? []}
            rowKey={row => row._id}
            scrollX={1050}
          />
        </NCard>

        <NCard title="增量同步队列">
          <p class="text-sm opacity-60 mb-4">
            内容新增、修改、删除会持久化为事件；失败事件按指数退避自动重试，也可手动立即重试。
          </p>
          <NDataTable
            loading={syncEventsQuery.isPending.value}
            columns={syncColumns}
            data={syncEventsQuery.data.value ?? []}
            rowKey={row => row._id}
            scrollX={900}
          />
        </NCard>

        <NDrawer show={logDrawerOpen.value} onUpdateShow={value => logDrawerOpen.value = value} width="min(720px, 92vw)">
          <NDrawerContent title={`重建任务 ${selectedTask.value?._id.slice(-8) ?? ""}`} closable>
            <div class="space-y-3">
              {selectedTask.value?.error && <NTag type="error">{selectedTask.value.error}</NTag>}
              <ol class="space-y-2 text-sm">
                {selectedTask.value?.logs.map((log, index) => (
                  <li key={`${index}-${log}`} class="font-mono whitespace-pre-wrap">
                    <span class="opacity-40 mr-2">{index + 1}.</span>{log}
                  </li>
                ))}
              </ol>
            </div>
          </NDrawerContent>
        </NDrawer>
      </div>
    );
  },
});
