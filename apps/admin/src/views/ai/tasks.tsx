import type { PropType, VNode } from "vue";
import type { AITask, AITaskLog } from "~/api/ai";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  AlertCircle as AlertCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  ArrowLeft as ArrowLeftIcon,
  CheckCircle as CheckCircleIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Clock as ClockIcon,
  Layers as LayersIcon,
  ListTodo as ListTodoIcon,
  Loader2 as LoaderIcon,
  RefreshCw as RefreshIcon,
  RotateCcw as RetryIcon,
  Trash2 as TrashIcon,
  XCircle as XCircleIcon,
} from "lucide-vue-next";
import {
  NButton,
  NPopconfirm,
  NProgress,
  NScrollbar,
  NSelect,
  NTag,
} from "naive-ui";
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
  watchEffect,
} from "vue";

import { toast } from "vue-sonner";

import { aiApi, AITaskStatus, AITaskType } from "~/api/ai";
import { HeaderActionButton } from "~/components/button/header-action-button";
import {
  MasterDetailLayout,
  useMasterDetailLayout,
} from "~/components/layout/master-detail-layout";
import { SplitPanelLayout } from "~/components/layout/split-panel-layout";
import { RelativeTime } from "~/components/time/relative-time";
import { queryKeys } from "~/hooks/queries/keys";
import { useLayout } from "~/hooks/use-layout";

const TaskTypeLabels: Record<AITaskType, string> = {
  [AITaskType.Summary]: "摘要生成",
  [AITaskType.Translation]: "翻译",
  [AITaskType.TranslationBatch]: "批量翻译",
  [AITaskType.TranslationAll]: "全量翻译",
  [AITaskType.SlugBackfill]: "Slug 回填",
  [AITaskType.Insights]: "精读生成",
  [AITaskType.InsightsTranslation]: "精读翻译",
};

const TaskStatusLabels: Record<AITaskStatus, string> = {
  [AITaskStatus.Pending]: "等待中",
  [AITaskStatus.Running]: "执行中",
  [AITaskStatus.Completed]: "已完成",
  [AITaskStatus.PartialFailed]: "部分失败",
  [AITaskStatus.Failed]: "失败",
  [AITaskStatus.Cancelled]: "已取消",
};

const TaskStatusIcons: Record<AITaskStatus, () => VNode> = {
  [AITaskStatus.Pending]: () => (
    <ClockIcon class="text-neutral-400 size-4" aria-hidden="true" />
  ),
  [AITaskStatus.Running]: () => (
    <LoaderIcon class="text-blue-500 size-4 animate-spin" aria-hidden="true" />
  ),
  [AITaskStatus.Completed]: () => (
    <CheckCircleIcon class="text-green-500 size-4" aria-hidden="true" />
  ),
  [AITaskStatus.PartialFailed]: () => (
    <AlertTriangleIcon class="text-yellow-500 size-4" aria-hidden="true" />
  ),
  [AITaskStatus.Failed]: () => (
    <AlertCircleIcon class="text-red-500 size-4" aria-hidden="true" />
  ),
  [AITaskStatus.Cancelled]: () => (
    <XCircleIcon class="text-neutral-400 size-4" aria-hidden="true" />
  ),
};

const TaskStatusColors: Record<AITaskStatus, string> = {
  [AITaskStatus.Pending]: "default",
  [AITaskStatus.Running]: "info",
  [AITaskStatus.Completed]: "success",
  [AITaskStatus.PartialFailed]: "warning",
  [AITaskStatus.Failed]: "error",
  [AITaskStatus.Cancelled]: "default",
};

export default defineComponent({
  name: "AITasksPage",
  setup() {
    const queryClient = useQueryClient();
    const statusFilter = ref<AITaskStatus | undefined>(undefined);
    const typeFilter = ref<AITaskType | undefined>(undefined);
    const pageRef = ref(1);
    const sizeRef = ref(50);
    const selectedTaskId = ref<string | null>(null);

    const { data, isPending, refetch } = useQuery({
      queryKey: computed(() =>
        queryKeys.ai.tasksList({
          status: statusFilter.value,
          type: typeFilter.value,
          page: pageRef.value,
          size: sizeRef.value,
        }),
      ),
      queryFn: () =>
        aiApi.getTasks({
          status: statusFilter.value,
          type: typeFilter.value,
          page: pageRef.value,
          size: sizeRef.value,
        }),
      refetchInterval: 5000,
    });

    const tasks = computed(() => data.value?.data || []);
    const total = computed(() => data.value?.total || 0);
    const selectedTask = computed(() =>
      tasks.value.find(t => t.id === selectedTaskId.value),
    );

    const statusOptions = [
      { label: "全部状态", value: undefined as AITaskStatus | undefined },
      { label: "等待中", value: AITaskStatus.Pending },
      { label: "执行中", value: AITaskStatus.Running },
      { label: "已完成", value: AITaskStatus.Completed },
      { label: "部分失败", value: AITaskStatus.PartialFailed },
      { label: "失败", value: AITaskStatus.Failed },
      { label: "已取消", value: AITaskStatus.Cancelled },
    ];

    const typeOptions = [
      { label: "全部类型", value: undefined as AITaskType | undefined },
      { label: "摘要生成", value: AITaskType.Summary },
      { label: "翻译", value: AITaskType.Translation },
      { label: "批量翻译", value: AITaskType.TranslationBatch },
      { label: "全量翻译", value: AITaskType.TranslationAll },
      { label: "Slug 回填", value: AITaskType.SlugBackfill },
      { label: "精读生成", value: AITaskType.Insights },
      { label: "精读翻译", value: AITaskType.InsightsTranslation },
    ];

    const handleCancelTask = async (taskId: string) => {
      await aiApi.cancelTask(taskId);
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.tasks() });
    };

    const handleDeleteTask = async (taskId: string) => {
      await aiApi.deleteTask(taskId);
      selectedTaskId.value = null;
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.tasks() });
      toast.success("任务已删除");
    };

    const handleDeleteCompleted = async () => {
      await aiApi.deleteTasks({
        status: AITaskStatus.Completed,
        before: Date.now(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.tasks() });
      toast.success("已清理已完成的任务");
    };

    const { setActions } = useLayout();
    watchEffect(() => {
      setActions(
        <div class="flex gap-2 items-center">
          <HeaderActionButton
            icon={<TrashIcon />}
            name="清理已完成"
            variant="error"
            onClick={handleDeleteCompleted}
          />
          <HeaderActionButton
            icon={
              isPending.value
                ? (
                    <LoaderIcon class="animate-spin" />
                  )
                : (
                    <RefreshIcon />
                  )
            }
            name="刷新"
            onClick={() => refetch()}
          />
        </div>,
      );
    });

    const EmptyState = () => (
      <div class="flex flex-col items-center inset-0 justify-center absolute -translate-y-[50px]">
        <ListTodoIcon
          class="text-neutral-300 mb-4 size-12 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          暂无 AI 任务
        </p>
      </div>
    );

    const EmptyDetail = () => (
      <div class="flex flex-col h-full items-center justify-center">
        <ListTodoIcon
          class="text-neutral-300 mb-4 size-10 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-400">选择一个任务查看详情</p>
      </div>
    );

    return () => (
      <MasterDetailLayout
        showDetailOnMobile={!!selectedTaskId.value}
        defaultSize="400px"
        min="300px"
        max="500px"
      >
        {{
          list: () => (
            <div class="flex flex-col h-full">
              <div class="p-3 border-b border-neutral-100 flex shrink-0 flex-wrap gap-2 items-center dark:border-neutral-800">
                <NSelect
                  value={statusFilter.value}
                  onUpdateValue={(v) => {
                    statusFilter.value = v || undefined;
                    pageRef.value = 1;
                  }}
                  options={statusOptions}
                  size="small"
                  style="width: 110px"
                  clearable
                  placeholder="状态…"
                />
                <NSelect
                  value={typeFilter.value}
                  onUpdateValue={(v) => {
                    typeFilter.value = v || undefined;
                    pageRef.value = 1;
                  }}
                  options={typeOptions}
                  size="small"
                  style="width: 110px"
                  clearable
                  placeholder="类型…"
                />
                <span class="text-xs text-neutral-400 tabular-nums">
                  {total.value}
                  {" "}
                  个任务
                </span>
              </div>

              <NScrollbar class="flex-1 min-h-0">
                {isPending.value && tasks.value.length === 0
                  ? (
                      <div class="py-16 flex items-center justify-center">
                        <LoaderIcon class="text-neutral-400 size-5 animate-spin" />
                      </div>
                    )
                  : tasks.value.length === 0
                    ? (
                        <EmptyState />
                      )
                    : (
                        <div>
                          {tasks.value.map(task => (
                            <TaskListItem
                              key={task.id}
                              task={task}
                              selected={selectedTaskId.value === task.id}
                              onClick={() => (selectedTaskId.value = task.id)}
                            />
                          ))}
                        </div>
                      )}
              </NScrollbar>
            </div>
          ),
          detail: () =>
            selectedTask.value
              ? (
                  <TaskDetailPanel
                    task={selectedTask.value}
                    onCancel={() => handleCancelTask(selectedTask.value!.id)}
                    onDelete={() => handleDeleteTask(selectedTask.value!.id)}
                    onBack={() => (selectedTaskId.value = null)}
                  />
                )
              : null,
          empty: () => <EmptyDetail />,
        }}
      </MasterDetailLayout>
    );
  },
});

const TaskListItem = defineComponent({
  props: {
    task: { type: Object as PropType<AITask>, required: true },
    selected: { type: Boolean, default: false },
    onClick: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const isBatchTask = computed(
      () =>
        props.task.type === AITaskType.TranslationBatch
        || props.task.type === AITaskType.TranslationAll,
    );

    const hasActiveSubTasks = computed(() => {
      if (!isBatchTask.value || !props.task.subTaskStats)
        return false;
      const stats = props.task.subTaskStats;
      return stats.pending > 0 || stats.running > 0;
    });

    const effectiveStatus = computed(() => {
      if (
        isBatchTask.value
        && props.task.status === AITaskStatus.Completed
        && hasActiveSubTasks.value
      ) {
        return AITaskStatus.Running;
      }
      return props.task.status;
    });

    const StatusIcon = computed(() => TaskStatusIcons[effectiveStatus.value]);

    const payloadSummary = computed(() => {
      const payload = props.task.payload;
      const result = props.task.result as Record<string, unknown> | undefined;
      if (props.task.type === AITaskType.Summary) {
        return (
          (payload.title as string) || (payload.refId as string) || "摘要任务"
        );
      }
      if (props.task.type === AITaskType.Translation) {
        return (
          (payload.title as string) || (payload.refId as string) || "翻译任务"
        );
      }
      if (props.task.type === AITaskType.TranslationBatch) {
        const count = (payload.refIds as string[])?.length || 0;
        return `${count} 篇文章`;
      }
      if (props.task.type === AITaskType.TranslationAll) {
        const count = (result?.total as number) || undefined;
        return count ? `${count} 篇文章` : "全部文章";
      }
      return "任务";
    });

    const statusLabel = computed(() => {
      if (hasActiveSubTasks.value && props.task.subTaskStats) {
        const stats = props.task.subTaskStats;
        return `${stats.completed + stats.failed}/${stats.total}`;
      }
      return TaskStatusLabels[effectiveStatus.value];
    });

    return () => (
      <div
        class={[
          "flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2.5 transition-colors dark:border-neutral-800",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
        ]}
        onClick={props.onClick}
      >
        <StatusIcon.value />
        <div class="flex-1 min-w-0">
          <div class="flex gap-2 items-center">
            <span class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
              {TaskTypeLabels[props.task.type]}
            </span>
            {isBatchTask.value && (
              <LayersIcon class="text-blue-500 size-3" aria-hidden="true" />
            )}
          </div>
          <div class="text-xs text-neutral-500 mt-0.5 truncate">
            {payloadSummary.value}
          </div>
        </div>
        <div class="text-right shrink-0">
          <NTag
            size="tiny"
            type={TaskStatusColors[effectiveStatus.value] as any}
          >
            {statusLabel.value}
          </NTag>
          <div class="mt-1">
            <RelativeTime
              time={new Date(props.task.createdAt)}
              class="text-xs text-neutral-400"
            />
          </div>
        </div>
      </div>
    );
  },
});

const TaskDetailPanel = defineComponent({
  props: {
    task: { type: Object as PropType<AITask>, required: true },
    onCancel: { type: Function as PropType<() => void>, required: true },
    onDelete: { type: Function as PropType<() => void>, required: true },
    onBack: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const queryClient = useQueryClient();
    const subTasksExpanded = ref(true);
    const subTasks = ref<AITask[]>([]);
    const loadingSubTasks = ref(false);
    const subTasksLoaded = ref(false);
    const selectedSubTaskId = ref<string | null>(null);

    const selectedSubTask = computed(() =>
      subTasks.value.find(t => t.id === selectedSubTaskId.value),
    );

    const isBatchTask = computed(
      () =>
        props.task.type === AITaskType.TranslationBatch
        || props.task.type === AITaskType.TranslationAll,
    );

    const hasActiveSubTasks = computed(() => {
      if (!isBatchTask.value)
        return false;
      const stats = subTasksLoaded.value
        ? {
            pending: subTasks.value.filter(
              t => t.status === AITaskStatus.Pending,
            ).length,
            running: subTasks.value.filter(
              t => t.status === AITaskStatus.Running,
            ).length,
          }
        : props.task.subTaskStats;
      if (!stats)
        return false;
      return stats.pending > 0 || stats.running > 0;
    });

    const effectiveStatus = computed(() => {
      if (
        isBatchTask.value
        && props.task.status === AITaskStatus.Completed
        && hasActiveSubTasks.value
      ) {
        return AITaskStatus.Running;
      }
      return props.task.status;
    });

    const StatusIcon = computed(() => TaskStatusIcons[effectiveStatus.value]);

    const canCancel = computed(
      () =>
        effectiveStatus.value === AITaskStatus.Pending
        || effectiveStatus.value === AITaskStatus.Running,
    );

    const canRetry = computed(
      () =>
        props.task.status === AITaskStatus.Failed
        || props.task.status === AITaskStatus.PartialFailed
        || props.task.status === AITaskStatus.Cancelled,
    );

    const canDelete = computed(
      () =>
        props.task.status === AITaskStatus.Completed
        || props.task.status === AITaskStatus.Failed
        || props.task.status === AITaskStatus.PartialFailed
        || props.task.status === AITaskStatus.Cancelled,
    );

    const failedLanguages = computed(() => {
      if (
        props.task.status !== AITaskStatus.PartialFailed
        || props.task.type !== AITaskType.Translation
      ) {
        return null;
      }
      const payload = props.task.payload;
      const result = props.task.result as
        | {
          translations?: Array<{ lang: string }>;
        }
        | undefined;
      const targetLangs = (payload.targetLanguages as string[]) || [];
      const successLangs = new Set(
        result?.translations?.map(t => t.lang) || [],
      );
      return targetLangs.filter(lang => !successLangs.has(lang));
    });

    const retryButtonLabel = computed(() =>
      failedLanguages.value && failedLanguages.value.length > 0
        ? "重试失败项"
        : "重试任务",
    );

    const handleRetryTask = async () => {
      try {
        const result = await aiApi.retryTask(props.task.id);
        if (result.created) {
          toast.success("已创建重试任务");
          queryClient.invalidateQueries({ queryKey: queryKeys.ai.tasks() });
        } else {
          toast.info("任务已存在");
        }
      } catch {
        toast.error("重试失败");
      }
    };

    const payloadSummary = computed(() => {
      const payload = props.task.payload;
      const result = props.task.result as Record<string, unknown> | undefined;
      if (props.task.type === AITaskType.Summary) {
        const title = (payload.title as string) || (payload.refId as string);
        return `文章: ${title}`;
      }
      if (props.task.type === AITaskType.Translation) {
        const title = (payload.title as string) || (payload.refId as string);
        const langs
          = (payload.targetLanguages as string[])?.join(", ") || "默认";
        return `${title} → ${langs}`;
      }
      if (props.task.type === AITaskType.TranslationBatch) {
        const count = (payload.refIds as string[])?.length || 0;
        const langs
          = (payload.targetLanguages as string[])?.join(", ") || "默认";
        return `${count} 篇文章 → ${langs}`;
      }
      if (props.task.type === AITaskType.TranslationAll) {
        const count = (result?.total as number) || undefined;
        const langs
          = (payload.targetLanguages as string[])?.join(", ") || "默认";
        return count ? `全部 ${count} 篇文章 → ${langs}` : `全部文章 → ${langs}`;
      }
      return JSON.stringify(payload);
    });

    const loadSubTasks = async (silent = false) => {
      if (loadingSubTasks.value)
        return;
      loadingSubTasks.value = true;
      try {
        const tasks = await aiApi.getTasksByGroupId(props.task.id);
        subTasks.value = tasks;
        subTasksLoaded.value = true;
      } catch {
        if (!silent)
          toast.error("加载子任务失败");
      } finally {
        loadingSubTasks.value = false;
      }
    };

    const handleCancelAllSubTasks = async () => {
      try {
        const result = await aiApi.cancelTasksByGroupId(props.task.id);
        toast.success(`已取消 ${result.cancelled} 个子任务`);
        await loadSubTasks(true);
        queryClient.invalidateQueries({ queryKey: queryKeys.ai.tasks() });
      } catch {
        toast.error("取消子任务失败");
      }
    };

    const subTaskStats = computed(() => {
      const tasks = subTasks.value;
      return {
        total: tasks.length,
        completed: tasks.filter(t => t.status === AITaskStatus.Completed)
          .length,
        failed: tasks.filter(t => t.status === AITaskStatus.Failed).length,
        running: tasks.filter(t => t.status === AITaskStatus.Running).length,
        pending: tasks.filter(t => t.status === AITaskStatus.Pending).length,
      };
    });

    onMounted(() => {
      if (isBatchTask.value)
        loadSubTasks(true);
    });

    const shouldPoll = computed(() => {
      if (subTaskStats.value.pending > 0 || subTaskStats.value.running > 0) {
        return true;
      }
      if (
        selectedSubTask.value
        && selectedSubTask.value.status === AITaskStatus.Running
      ) {
        return true;
      }
      return false;
    });

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollInterval)
        return;
      pollInterval = setInterval(async () => {
        if (!shouldPoll.value) {
          stopPolling();
          return;
        }
        await loadSubTasks(true);
      }, 3000);
    };
    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    watch(
      () => props.task.id,
      () => {
        if (isBatchTask.value) {
          subTasks.value = [];
          subTasksLoaded.value = false;
          selectedSubTaskId.value = null;
          loadSubTasks(true);
        }
      },
    );

    watch(subTasksLoaded, (loaded) => {
      if (loaded && shouldPoll.value) {
        startPolling();
      }
    });

    watch(selectedSubTaskId, (newId) => {
      if (newId && subTasksLoaded.value) {
        loadSubTasks(true);
        if (shouldPoll.value && !pollInterval) {
          startPolling();
        }
      }
    });

    onUnmounted(() => stopPolling());

    return () => (
      <NScrollbar class="h-full">
        <div class="p-4">
          <div class="mb-4 flex items-start justify-between">
            <div class="flex gap-3 items-center">
              <StatusIcon.value />
              <div>
                <h2 class="text-base text-neutral-900 font-semibold dark:text-neutral-100">
                  {TaskTypeLabels[props.task.type]}
                </h2>
                <p class="text-sm text-neutral-500 mt-0.5">
                  {payloadSummary.value}
                </p>
              </div>
            </div>
            <div class="flex gap-2 items-center">
              <NTag
                size="small"
                type={TaskStatusColors[effectiveStatus.value] as any}
              >
                {TaskStatusLabels[effectiveStatus.value]}
              </NTag>
              {props.task.retryCount > 0 && (
                <NTag size="small" type="warning">
                  重试
                  {" "}
                  {props.task.retryCount}
                </NTag>
              )}
              {isBatchTask.value && (
                <NTag size="small" type="info">
                  <LayersIcon class="mr-1 size-3 inline" aria-hidden="true" />
                  批量
                </NTag>
              )}
            </div>
          </div>

          {isBatchTask.value
            && subTasksLoaded.value
            && subTaskStats.value.total > 0 && (
            <div class="mb-4">
              <NProgress
                type="line"
                percentage={Math.round(
                  ((subTaskStats.value.completed
                    + subTaskStats.value.failed)
                  / subTaskStats.value.total)
                * 100,
                )}
                status={subTaskStats.value.failed > 0 ? "error" : "info"}
              />
              <div class="text-xs mt-1 flex gap-3 items-center tabular-nums">
                <span class="text-green-600">
                  {subTaskStats.value.completed}
                  {" "}
                  完成
                </span>
                <span class="text-blue-600">
                  {subTaskStats.value.running}
                  {" "}
                  进行中
                </span>
                <span class="text-neutral-500">
                  {subTaskStats.value.pending}
                  {" "}
                  等待
                </span>
                {subTaskStats.value.failed > 0 && (
                  <span class="text-red-600">
                    {subTaskStats.value.failed}
                    {" "}
                    失败
                  </span>
                )}
              </div>
            </div>
          )}

          {!isBatchTask.value
            && props.task.status === AITaskStatus.Running
            && props.task.tokensGenerated !== undefined
            && props.task.tokensGenerated > 0 && (
            <div class="mb-4 px-3 py-2 rounded-lg bg-blue-50 flex gap-2 items-center dark:bg-blue-950/50">
              <LoaderIcon
                class="text-blue-500 size-4 animate-spin"
                aria-hidden="true"
              />
              <span class="text-sm text-blue-700 dark:text-blue-300">
                已生成
                {" "}
                <span class="font-medium tabular-nums">
                  {props.task.tokensGenerated}
                </span>
                {" "}
                个 token
              </span>
            </div>
          )}

          {props.task.error && (
            <div
              class="text-sm text-red-700 mb-4 p-3 rounded-lg bg-red-50 dark:text-red-300 dark:bg-red-950/50"
              role="alert"
            >
              <strong class="font-medium">错误：</strong>
              {props.task.error}
            </div>
          )}

          {failedLanguages.value && failedLanguages.value.length > 0 && (
            <div class="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/50">
              <div class="text-sm text-yellow-800 font-medium mb-1.5 dark:text-yellow-200">
                失败语言
              </div>
              <div class="flex flex-wrap gap-1.5">
                {failedLanguages.value.map(lang => (
                  <NTag key={lang} size="small" type="warning">
                    {lang}
                  </NTag>
                ))}
              </div>
            </div>
          )}

          {(canCancel.value || canRetry.value || canDelete.value) && (
            <div class="mb-4 flex gap-2 items-center">
              {canCancel.value && (
                <NPopconfirm
                  positiveText="保留"
                  negativeText="终止"
                  onNegativeClick={props.onCancel}
                >
                  {{
                    trigger: () => (
                      <NButton size="small" type="error" secondary>
                        {{
                          icon: () => (
                            <XCircleIcon class="size-4" aria-hidden="true" />
                          ),
                          default: () => "终止任务",
                        }}
                      </NButton>
                    ),
                    default: () => "终止此任务后将无法恢复",
                  }}
                </NPopconfirm>
              )}
              {canRetry.value && (
                <NButton
                  size="small"
                  type="primary"
                  secondary
                  onClick={handleRetryTask}
                >
                  {{
                    icon: () => <RetryIcon class="size-4" aria-hidden="true" />,
                    default: () => retryButtonLabel.value,
                  }}
                </NButton>
              )}
              {canDelete.value && (
                <NPopconfirm
                  positiveText="保留"
                  negativeText="删除"
                  onNegativeClick={props.onDelete}
                >
                  {{
                    trigger: () => (
                      <NButton size="small" type="error" tertiary>
                        {{
                          icon: () => (
                            <TrashIcon class="size-4" aria-hidden="true" />
                          ),
                          default: () => "删除任务",
                        }}
                      </NButton>
                    ),
                    default: () => "删除此任务记录？",
                  }}
                </NPopconfirm>
              )}
            </div>
          )}

          {isBatchTask.value && (
            <div class="mb-4">
              <button
                type="button"
                class="text-sm text-neutral-700 font-medium mb-2 flex gap-2 w-full items-center dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
                onClick={() =>
                  (subTasksExpanded.value = !subTasksExpanded.value)}
              >
                {subTasksExpanded.value
                  ? (
                      <ChevronDownIcon class="size-4" aria-hidden="true" />
                    )
                  : (
                      <ChevronRightIcon class="size-4" aria-hidden="true" />
                    )}
                子任务
                <span class="text-neutral-500 tabular-nums">
                  (
                  {subTasks.value.length}
                  )
                </span>
                {subTaskStats.value.pending + subTaskStats.value.running
                  > 0 && (
                  <NPopconfirm
                    positiveText="保留"
                    negativeText="全部取消"
                    onNegativeClick={handleCancelAllSubTasks}
                  >
                    {{
                      trigger: () => (
                        <NButton
                          size="tiny"
                          type="error"
                          quaternary
                          onClick={(e: Event) => e.stopPropagation()}
                        >
                          取消所有
                        </NButton>
                      ),
                      default: () => "取消所有进行中的子任务",
                    }}
                  </NPopconfirm>
                )}
              </button>

              {subTasksExpanded.value && (
                <div class="border border-neutral-200 rounded-lg bg-white h-80 overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">
                  <SplitPanelLayout
                    showPanel={!!selectedSubTaskId.value}
                    defaultSize={0.4}
                    min={0.3}
                    max={0.6}
                    forceMobile={false}
                  >
                    {{
                      list: () => (
                        <NScrollbar class="h-full">
                          {loadingSubTasks.value
                            && subTasks.value.length === 0
                            ? (
                                <div class="py-6 flex items-center justify-center">
                                  <LoaderIcon class="text-neutral-400 size-4 animate-spin" />
                                </div>
                              )
                            : subTasks.value.length === 0
                              ? (
                                  <div class="text-xs text-neutral-400 py-6 text-center">
                                    暂无子任务
                                  </div>
                                )
                              : (
                                  <div class="divide-neutral-100 divide-y dark:divide-neutral-800">
                                    {subTasks.value.map(subTask => (
                                      <SubTaskItem
                                        key={subTask.id}
                                        task={subTask}
                                        selected={
                                          selectedSubTaskId.value === subTask.id
                                        }
                                        onClick={() =>
                                          (selectedSubTaskId.value = subTask.id)}
                                      />
                                    ))}
                                  </div>
                                )}
                        </NScrollbar>
                      ),
                      panel: () =>
                        selectedSubTask.value
                          ? (
                              <SubTaskDetailPanel
                                task={selectedSubTask.value}
                                onBack={() => (selectedSubTaskId.value = null)}
                                onRetry={() => loadSubTasks(true)}
                              />
                            )
                          : null,
                      empty: () => (
                        <div class="flex flex-col h-full items-center justify-center">
                          <ListTodoIcon
                            class="text-neutral-300 mb-2 size-8 dark:text-neutral-600"
                            aria-hidden="true"
                          />
                          <p class="text-xs text-neutral-400">
                            选择子任务查看详情
                          </p>
                        </div>
                      ),
                    }}
                  </SplitPanelLayout>
                </div>
              )}
            </div>
          )}

          {props.task.result && (
            <div class="mb-4">
              <div class="text-sm text-neutral-700 font-medium mb-2 dark:text-neutral-300">
                结果
              </div>
              <pre class="text-xs leading-relaxed font-mono p-3 rounded-lg bg-neutral-100 overflow-auto dark:bg-neutral-800">
                {JSON.stringify(props.task.result, null, 2)}
              </pre>
            </div>
          )}

          {props.task.logs.length > 0 && (
            <div class="mb-4">
              <div class="text-sm text-neutral-700 font-medium mb-2 dark:text-neutral-300">
                日志
                <span class="text-neutral-500 ml-1 tabular-nums">
                  (
                  {props.task.logs.length}
                  )
                </span>
              </div>
              <div class="p-3 rounded-lg bg-neutral-100 max-h-48 overflow-auto space-y-0.5 dark:bg-neutral-800">
                {props.task.logs.map((log, idx) => (
                  <LogLine key={idx} log={log} />
                ))}
              </div>
            </div>
          )}

          <div class="text-xs space-y-2">
            <div class="flex gap-2 items-center">
              <span class="text-neutral-500">任务 ID</span>
              <code class="font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                {props.task.id}
              </code>
            </div>
            {props.task.workerId && (
              <div class="flex gap-2 items-center">
                <span class="text-neutral-500">Worker</span>
                <code class="font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                  {props.task.workerId}
                </code>
              </div>
            )}
            {props.task.groupId && (
              <div class="flex gap-2 items-center">
                <span class="text-neutral-500">批量任务</span>
                <code class="font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                  {props.task.groupId}
                </code>
              </div>
            )}
            {props.task.tokensGenerated !== undefined
              && props.task.tokensGenerated > 0 && (
              <div class="flex gap-2 items-center">
                <span class="text-neutral-500">生成 Tokens</span>
                <span class="text-neutral-700 tabular-nums dark:text-neutral-300">
                  {props.task.tokensGenerated}
                </span>
              </div>
            )}
            <div class="flex gap-2 items-center">
              <span class="text-neutral-500">创建于</span>
              <RelativeTime time={new Date(props.task.createdAt)} />
            </div>
            {props.task.completedAt && (
              <div class="flex gap-2 items-center">
                <span class="text-neutral-500">完成于</span>
                <RelativeTime time={new Date(props.task.completedAt)} />
              </div>
            )}
          </div>
        </div>
      </NScrollbar>
    );
  },
});

const SubTaskItem = defineComponent({
  props: {
    task: { type: Object as PropType<AITask>, required: true },
    selected: { type: Boolean, default: false },
    onClick: { type: Function as PropType<() => void> },
  },
  setup(props) {
    const StatusIcon = computed(() => TaskStatusIcons[props.task.status]);

    const title = computed(() => {
      const payload = props.task.payload;
      return (payload.title as string) || (payload.refId as string) || "子任务";
    });

    return () => (
      <div
        class={[
          "flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
        ]}
        onClick={props.onClick}
      >
        <StatusIcon.value />
        <span class="text-xs text-neutral-700 flex-1 min-w-0 truncate dark:text-neutral-300">
          {title.value}
        </span>
        {props.task.status === AITaskStatus.Running
          && props.task.tokensGenerated !== undefined
          && props.task.tokensGenerated > 0 && (
          <span class="text-xs text-blue-500 shrink-0 tabular-nums">
            {props.task.tokensGenerated}
            {" "}
            tokens
          </span>
        )}
        <NTag size="tiny" type={TaskStatusColors[props.task.status] as any}>
          {TaskStatusLabels[props.task.status]}
        </NTag>
      </div>
    );
  },
});

const SubTaskDetailPanel = defineComponent({
  props: {
    task: { type: Object as PropType<AITask>, required: true },
    onBack: { type: Function as PropType<() => void> },
    onRetry: { type: Function as PropType<() => void> },
  },
  setup(props) {
    const queryClient = useQueryClient();
    const { isMobile } = useMasterDetailLayout();
    const StatusIcon = computed(() => TaskStatusIcons[props.task.status]);

    const title = computed(() => {
      const payload = props.task.payload;
      return (payload.title as string) || (payload.refId as string) || "子任务";
    });

    const targetLanguages = computed(() => {
      const payload = props.task.payload;
      return (payload.targetLanguages as string[])?.join(", ") || "默认";
    });

    const canRetry = computed(
      () =>
        props.task.status === AITaskStatus.Failed
        || props.task.status === AITaskStatus.PartialFailed
        || props.task.status === AITaskStatus.Cancelled,
    );

    const subTaskFailedLanguages = computed(() => {
      if (
        props.task.status !== AITaskStatus.PartialFailed
        || props.task.type !== AITaskType.Translation
      ) {
        return null;
      }
      const payload = props.task.payload;
      const result = props.task.result as
        | {
          translations?: Array<{ lang: string }>;
        }
        | undefined;
      const targetLangs = (payload.targetLanguages as string[]) || [];
      const successLangs = new Set(
        result?.translations?.map(t => t.lang) || [],
      );
      return targetLangs.filter(lang => !successLangs.has(lang));
    });

    const subRetryLabel = computed(() =>
      subTaskFailedLanguages.value && subTaskFailedLanguages.value.length > 0
        ? "重试失败项"
        : "重试",
    );

    const handleRetry = async () => {
      try {
        const result = await aiApi.retryTask(props.task.id);
        if (result.created) {
          toast.success("已创建重试任务");
          queryClient.invalidateQueries({ queryKey: queryKeys.ai.tasks() });
          props.onRetry?.();
        } else {
          toast.info("任务已存在");
        }
      } catch {
        toast.error("重试失败");
      }
    };

    return () => (
      <NScrollbar class="h-full">
        <div class="p-3">
          {isMobile.value && props.onBack && (
            <div class="mb-3">
              <button
                type="button"
                class="text-sm text-neutral-600 flex gap-1.5 transition-colors items-center dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                onClick={props.onBack}
              >
                <ArrowLeftIcon class="size-4" aria-hidden="true" />
                返回列表
              </button>
            </div>
          )}

          <div class="mb-3 flex gap-2 items-start">
            <StatusIcon.value />
            <div class="flex-1 min-w-0">
              <h3 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
                {title.value}
              </h3>
              <p class="text-xs text-neutral-500 mt-0.5">
                →
                {" "}
                {targetLanguages.value}
              </p>
            </div>
            <NTag size="tiny" type={TaskStatusColors[props.task.status] as any}>
              {TaskStatusLabels[props.task.status]}
            </NTag>
          </div>

          {subTaskFailedLanguages.value
            && subTaskFailedLanguages.value.length > 0 && (
            <div class="mb-3 p-2 rounded bg-yellow-50 dark:bg-yellow-950/50">
              <div class="text-xs text-yellow-800 font-medium mb-1 dark:text-yellow-200">
                失败语言
              </div>
              <div class="flex flex-wrap gap-1">
                {subTaskFailedLanguages.value.map(lang => (
                  <NTag key={lang} size="tiny" type="warning">
                    {lang}
                  </NTag>
                ))}
              </div>
            </div>
          )}

          {canRetry.value && (
            <div class="mb-3">
              <NButton
                size="tiny"
                type="primary"
                secondary
                onClick={handleRetry}
              >
                {{
                  icon: () => <RetryIcon class="size-3" aria-hidden="true" />,
                  default: () => subRetryLabel.value,
                }}
              </NButton>
            </div>
          )}

          {props.task.status === AITaskStatus.Running
            && props.task.tokensGenerated !== undefined
            && props.task.tokensGenerated > 0 && (
            <div class="mb-3 px-2 py-1.5 rounded bg-blue-50 flex gap-2 items-center dark:bg-blue-950/50">
              <LoaderIcon
                class="text-blue-500 size-3 animate-spin"
                aria-hidden="true"
              />
              <span class="text-xs text-blue-700 dark:text-blue-300">
                <span class="tabular-nums">{props.task.tokensGenerated}</span>
                {" "}
                tokens
              </span>
            </div>
          )}

          {props.task.error && (
            <div
              class="text-xs text-red-700 mb-3 p-2 rounded bg-red-50 dark:text-red-300 dark:bg-red-950/50"
              role="alert"
            >
              {props.task.error}
            </div>
          )}

          {props.task.result && (
            <div class="mb-3">
              <div class="text-xs text-neutral-600 font-medium mb-1 dark:text-neutral-400">
                结果
              </div>
              <pre class="text-xs leading-relaxed font-mono p-2 rounded bg-neutral-100 overflow-auto dark:bg-neutral-800">
                {JSON.stringify(props.task.result, null, 2)}
              </pre>
            </div>
          )}

          {props.task.logs.length > 0 && (
            <div class="mb-3">
              <div class="text-xs text-neutral-600 font-medium mb-1 dark:text-neutral-400">
                日志
                <span class="text-neutral-400 ml-1 tabular-nums">
                  (
                  {props.task.logs.length}
                  )
                </span>
              </div>
              <div class="p-2 rounded bg-neutral-100 max-h-32 overflow-auto space-y-0.5 dark:bg-neutral-800">
                {props.task.logs.map((log, idx) => (
                  <LogLine key={idx} log={log} />
                ))}
              </div>
            </div>
          )}

          <div class="text-xs space-y-1">
            <div class="flex gap-2 items-center">
              <span class="text-neutral-400">ID</span>
              <code class="text-xs font-mono px-1 py-0.5 rounded bg-neutral-100 truncate dark:bg-neutral-800">
                {props.task.id}
              </code>
            </div>
            <div class="flex gap-2 items-center">
              <span class="text-neutral-400">创建</span>
              <RelativeTime
                time={new Date(props.task.createdAt)}
                class="text-xs"
              />
            </div>
            {props.task.completedAt && (
              <div class="flex gap-2 items-center">
                <span class="text-neutral-400">完成</span>
                <RelativeTime
                  time={new Date(props.task.completedAt)}
                  class="text-xs"
                />
              </div>
            )}
          </div>
        </div>
      </NScrollbar>
    );
  },
});

const LogLine = defineComponent({
  props: {
    log: { type: Object as PropType<AITaskLog>, required: true },
  },
  setup(props) {
    const levelColors: Record<string, string> = {
      info: "text-blue-600 dark:text-blue-400",
      warn: "text-yellow-600 dark:text-yellow-400",
      error: "text-red-600 dark:text-red-400",
    };

    const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return () => (
      <div class="text-xs font-mono flex gap-2">
        <span class="text-neutral-400 shrink-0">
          {timeFormatter.format(props.log.timestamp)}
        </span>
        <span class={["shrink-0", levelColors[props.log.level] || ""]}>
          [
          {props.log.level.toUpperCase()}
          ]
        </span>
        <span class="text-neutral-700 min-w-0 break-words dark:text-neutral-300">
          {props.log.message}
        </span>
      </div>
    );
  },
});
