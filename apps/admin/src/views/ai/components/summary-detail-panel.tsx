import type { PropType } from "vue";
import type { AISummary, ArticleInfo } from "~/api/ai";
import { format } from "date-fns";
import {
  ArrowLeft as ArrowLeftIcon,
  Calendar as CalendarIcon,
  FileText as FileTextIcon,
  Pencil as PencilIcon,
  Plus as PlusIcon,
  Save as SaveIcon,
  Sparkles as SparklesIcon,
  StickyNote as StickyNoteIcon,
  Trash2 as TrashIcon,
  X as XIcon,
} from "lucide-vue-next";
import { NButton, NEmpty, NInput, NPopconfirm, NScrollbar } from "naive-ui";
import { computed, defineComponent, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";

import { aiApi, AITaskType } from "~/api/ai";
import { useAiTaskQueue } from "~/components/ai-task-queue";
import { SplitPanelEmptyState, SplitPanelLayout } from "~/components/layout";

type ArticleRefType = ArticleInfo["type"];

const safeFormat = (value: unknown, pattern: string, fallback = "-") => {
  if (value === null || value === undefined || value === "") {
    console.warn("[safeFormat] empty value", value);
    return fallback;
  }
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) {
    console.warn("[safeFormat] invalid date", { value, type: typeof value });
    return fallback;
  }
  return format(d, pattern);
};

const RefTypeIcons: Record<ArticleRefType, typeof FileTextIcon> = {
  Post: FileTextIcon,
  Note: StickyNoteIcon,
  Page: FileTextIcon,
  Recently: FileTextIcon,
};

type ActivePanel = { type: "edit"; summary: AISummary } | null;

export const SummaryDetailPanel = defineComponent({
  name: "SummaryDetailPanel",
  props: {
    articleId: {
      type: String as PropType<string | null>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onRefresh: {
      type: Function as PropType<() => void>,
    },
  },
  setup(props) {
    const taskQueue = useAiTaskQueue();

    const article = ref<{
      type: ArticleRefType;
      document: { title: string };
    } | null>(null);
    const summaries = ref<AISummary[]>([]);
    const loading = ref(false);
    const activePanel = ref<ActivePanel>(null);

    const setActivePanel = (panel: ActivePanel) => {
      activePanel.value = panel;
    };

    const fetchData = async (refId: string) => {
      loading.value = true;
      try {
        const data = await aiApi.getSummaryByRef(refId);
        article.value = data.article;
        summaries.value = data.summaries;
      } finally {
        loading.value = false;
      }
    };

    watch(
      () => props.articleId,
      (id) => {
        if (id) {
          fetchData(id);
          activePanel.value = null;
        } else {
          article.value = null;
          summaries.value = [];
          activePanel.value = null;
        }
      },
      { immediate: true },
    );

    const handleDelete = async (id: string) => {
      await aiApi.deleteSummary(id);
      summaries.value = summaries.value.filter(s => s.id !== id);
      toast.success("删除成功");
      props.onRefresh?.();
      if (
        activePanel.value?.type === "edit"
        && activePanel.value.summary.id === id
      ) {
        activePanel.value = null;
      }
    };

    const handleGenerate = () => {
      if (!props.articleId)
        return;

      const loadingRef = ref(false);
      const langRef = ref("zh");

      const $dialog = dialog.create({
        title: "生成 AI 摘要",
        content() {
          return (
            <div class="flex flex-col gap-4">
              <div>
                <label class="text-sm text-neutral-600 mb-2 block dark:text-neutral-400">
                  目标语言
                </label>
                <NInput
                  value={langRef.value}
                  onUpdateValue={v => (langRef.value = v)}
                  placeholder="zh, en, ja..."
                />
              </div>
              <div class="text-right">
                <NButton
                  size="small"
                  type="primary"
                  loading={loadingRef.value}
                  onClick={() => {
                    if (!langRef.value)
                      return;
                    loadingRef.value = true;
                    const taskPayload = {
                      refId: props.articleId!,
                      lang: langRef.value,
                    };
                    aiApi
                      .createSummaryTask(taskPayload)
                      .then((res) => {
                        if (res.created) {
                          taskQueue.trackTask({
                            taskId: res.taskId,
                            type: AITaskType.Summary,
                            label: `摘要: ${article.value?.document.title || "文章"}`,
                            onComplete: () => {
                              fetchData(props.articleId!);
                            },
                            retryFn: () => aiApi.createSummaryTask(taskPayload),
                          });
                          toast.success("已创建摘要生成任务");
                        } else {
                          toast.info("任务已存在，正在处理中");
                        }
                        $dialog.destroy();
                      })
                      .finally(() => {
                        loadingRef.value = false;
                      });
                  }}
                >
                  <SparklesIcon class="mr-1.5 size-4" />
                  生成
                </NButton>
              </div>
            </div>
          );
        },
      });
    };

    const handleEdit = (item: AISummary) => {
      setActivePanel({ type: "edit", summary: item });
    };

    const handleSaveEdit = (id: string, summary: string) => {
      const idx = summaries.value.findIndex(s => s.id === id);
      if (idx !== -1) {
        summaries.value[idx].summary = summary;
      }
    };

    const RefIcon = computed(() =>
      article.value ? RefTypeIcons[article.value.type] : FileTextIcon,
    );

    const hasPanel = computed(() => activePanel.value !== null);

    // 左侧内容：文章信息 + 摘要列表
    const ListContent = () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            {props.isMobile && props.onBack && (
              <button
                onClick={props.onBack}
                class="text-neutral-500 rounded-md flex size-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon class="size-5" />
              </button>
            )}
            <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              摘要详情
            </h2>
          </div>

          {article.value && (
            <NButton size="small" type="primary" onClick={handleGenerate}>
              {{
                icon: () => <PlusIcon class="size-4" />,
                default: () => "生成摘要",
              }}
            </NButton>
          )}
        </div>

        <NScrollbar class="flex-1 min-h-0">
          {loading.value
            ? (
                <div class="flex h-full items-center justify-center">
                  <div class="border-2 border-neutral-300 border-t-neutral-900 rounded-full size-6 animate-spin dark:border-neutral-700 dark:border-t-white" />
                </div>
              )
            : article.value
              ? (
                  <div class="p-4 space-y-4">
                    <div>
                      <RouterLink
                        to={`/${article.value.type.toLowerCase()}/edit?id=${props.articleId}`}
                        class="group no-underline inline-flex gap-2 items-center"
                      >
                        <RefIcon.value class="text-neutral-400 shrink-0 size-5" />
                        <h3 class="text-base text-neutral-900 font-semibold transition-colors dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {article.value.document.title}
                        </h3>
                      </RouterLink>
                    </div>

                    <div class="bg-neutral-100 h-px dark:bg-neutral-800" />

                    <div>
                      <h4 class="text-sm text-neutral-700 font-medium mb-3 dark:text-neutral-300">
                        摘要列表
                        <span class="text-xs text-neutral-400 ml-1">
                          (
                          {summaries.value.length}
                          )
                        </span>
                      </h4>

                      {summaries.value.length === 0
                        ? (
                            <NEmpty description="暂无摘要">
                              {{
                                extra: () => (
                                  <NButton size="small" onClick={handleGenerate}>
                                    生成摘要
                                  </NButton>
                                ),
                              }}
                            </NEmpty>
                          )
                        : (
                            <div class="divide-neutral-100 divide-y -mx-4 dark:divide-neutral-800">
                              {summaries.value.map(summary => (
                                <SummaryListItem
                                  key={summary.id}
                                  item={summary}
                                  selected={
                                    activePanel.value?.type === "edit"
                                    && activePanel.value.summary.id === summary.id
                                  }
                                  onEdit={() => handleEdit(summary)}
                                  onDelete={() => handleDelete(summary.id)}
                                />
                              ))}
                            </div>
                          )}
                    </div>
                  </div>
                )
              : null}
        </NScrollbar>
      </div>
    );

    // 右侧面板内容
    const PanelContent = () => {
      if (activePanel.value?.type === "edit") {
        return (
          <SummaryEditPanel
            summary={activePanel.value.summary}
            onSave={handleSaveEdit}
            onClose={() => setActivePanel(null)}
          />
        );
      }
      return null;
    };

    return () => (
      <SplitPanelLayout showPanel={hasPanel.value} forceMobile={props.isMobile}>
        {{
          list: ListContent,
          panel: PanelContent,
          empty: () => (
            <SplitPanelEmptyState
              icon={() => <PencilIcon class="text-neutral-400 size-6" />}
              title="选择一条摘要"
              description="从左侧列表选择摘要进行编辑"
            />
          ),
        }}
      </SplitPanelLayout>
    );
  },
});

const SummaryListItem = defineComponent({
  props: {
    item: {
      type: Object as PropType<AISummary>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    onEdit: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div
        class={[
          "group cursor-pointer px-4 py-3 transition-colors",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
        ]}
        onClick={props.onEdit}
      >
        <div class="mb-1.5 flex items-center justify-between">
          <div class="flex gap-2 items-center">
            <span class="text-xs text-blue-600 font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:text-blue-400 dark:bg-blue-950">
              {props.item.lang.toUpperCase()}
            </span>
            <span class="text-xs text-neutral-400 flex gap-1 items-center">
              <CalendarIcon class="size-3" />
              {safeFormat(props.item.createdAt, "MM-dd HH:mm")}
            </span>
          </div>

          <div
            class="opacity-0 flex gap-1 transition-opacity items-center group-hover:opacity-100"
            onClick={e => e.stopPropagation()}
          >
            <NPopconfirm
              positiveText="取消"
              negativeText="删除"
              onNegativeClick={props.onDelete}
            >
              {{
                trigger: () => (
                  <button class="text-neutral-500 rounded flex size-7 transition-colors items-center justify-center dark:text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950">
                    <TrashIcon class="size-3.5" />
                  </button>
                ),
                default: () => "确定要删除这条摘要吗？",
              }}
            </NPopconfirm>
          </div>
        </div>

        <p class="text-sm text-neutral-700 line-clamp-2 dark:text-neutral-300">
          {props.item.summary}
        </p>
      </div>
    );
  },
});

const SummaryEditPanel = defineComponent({
  props: {
    summary: {
      type: Object as PropType<AISummary>,
      required: true,
    },
    onSave: {
      type: Function as PropType<(id: string, summary: string) => void>,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const summaryRef = ref(props.summary.summary);
    const saving = ref(false);

    watch(
      () => props.summary.id,
      () => {
        summaryRef.value = props.summary.summary;
      },
    );

    const handleSave = async () => {
      if (!summaryRef.value) {
        toast.warning("摘要内容不能为空");
        return;
      }
      saving.value = true;
      try {
        await aiApi.updateSummary(props.summary.id, {
          summary: summaryRef.value,
        });
        props.onSave(props.summary.id, summaryRef.value);
        toast.success("保存成功");
        props.onClose();
      } finally {
        saving.value = false;
      }
    };

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            <button
              type="button"
              class="text-neutral-500 rounded-md flex size-8 transition-colors items-center justify-center dark:text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              onClick={props.onClose}
            >
              <ArrowLeftIcon class="size-5" />
            </button>
            <div>
              <h2 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
                编辑摘要
              </h2>
              <span class="text-xs text-neutral-500">
                {props.summary.lang.toUpperCase()}
              </span>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <NButton size="small" onClick={props.onClose}>
              <XIcon class="mr-1 size-4" />
              取消
            </NButton>
            <NButton
              size="small"
              type="primary"
              loading={saving.value}
              onClick={handleSave}
            >
              <SaveIcon class="mr-1 size-4" />
              保存
            </NButton>
          </div>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          <div class="p-4 space-y-4">
            <div>
              <label class="text-sm text-neutral-700 font-medium mb-2 block dark:text-neutral-300">
                摘要内容
              </label>
              <NInput
                value={summaryRef.value}
                onUpdateValue={v => (summaryRef.value = v)}
                type="textarea"
                rows={8}
                placeholder="摘要内容"
              />
            </div>

            <div>
              <label class="text-sm text-neutral-700 font-medium mb-2 block dark:text-neutral-300">
                预览
              </label>
              <div class="p-4 border border-neutral-200 rounded-lg bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap dark:text-neutral-300">
                  {summaryRef.value || "无内容"}
                </p>
              </div>
            </div>

            <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900">
              <h4 class="text-sm text-neutral-700 font-medium mb-3 dark:text-neutral-300">
                元信息
              </h4>
              <div class="text-xs space-y-2">
                <div class="flex gap-2 items-center">
                  <span class="text-neutral-500">创建时间</span>
                  <span class="text-neutral-700 dark:text-neutral-300">
                    {safeFormat(props.summary.createdAt, "yyyy-MM-dd HH:mm:ss")}
                  </span>
                </div>
                <div class="flex gap-2 items-center">
                  <span class="text-neutral-500">语言</span>
                  <span class="text-neutral-700 dark:text-neutral-300">
                    {props.summary.lang.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </NScrollbar>
      </div>
    );
  },
});

export const SummaryDetailEmptyState = defineComponent({
  name: "SummaryDetailEmptyState",
  setup() {
    return () => (
      <div class="text-center bg-neutral-50 flex flex-col h-full items-center justify-center dark:bg-neutral-950">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <SparklesIcon class="text-neutral-400 size-8" />
        </div>
        <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">
          选择一篇文章
        </h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          从左侧列表选择文章查看 AI 摘要
        </p>
      </div>
    );
  },
});
