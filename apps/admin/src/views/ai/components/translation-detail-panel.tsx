import type { SerializedEditorState } from "lexical";
import type { PropType } from "vue";
import type { AITranslation, ArticleInfo } from "~/api/ai";
import { createThemeStyle } from "@haklex/rich-style-token";
import { format } from "date-fns";
import {
  ArrowLeft as ArrowLeftIcon,
  Bot as BotIcon,
  Calendar as CalendarIcon,
  FileText as FileTextIcon,
  Languages as LanguagesIcon,
  Pencil as PencilIcon,
  Plus as PlusIcon,
  RotateCw as RotateCwIcon,
  Save as SaveIcon,
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
import { RichEditor } from "~/components/editor/rich/RichEditor";
import { SplitPanelEmptyState, SplitPanelLayout } from "~/components/layout";
import { MarkdownRender } from "~/components/markdown/markdown-render";

const richEditorStyleOverride = createThemeStyle({
  layout: { maxWidth: "100%" },
});

type ArticleRefType = ArticleInfo["type"];

const RefTypeIcons: Record<ArticleRefType, typeof FileTextIcon> = {
  Post: FileTextIcon,
  Note: StickyNoteIcon,
  Page: FileTextIcon,
  Recently: FileTextIcon,
};

type ActivePanel = { type: "edit"; translation: AITranslation } | null;

export const TranslationDetailPanel = defineComponent({
  name: "TranslationDetailPanel",
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
    onOptimisticUpdate: {
      type: Function as PropType<
        (
          update:
            | {
              type: "upsert";
              article: ArticleInfo;
              translations: AITranslation[];
            }
            | {
              type: "remove";
              articleId: string;
              translationId: string;
              lang: string;
            },
        ) => void
      >,
    },
  },
  setup(props) {
    const taskQueue = useAiTaskQueue();

    const article = ref<{
      type: ArticleRefType;
      document: { title: string };
    } | null>(null);
    const translations = ref<AITranslation[]>([]);
    const loading = ref(false);
    const regenerationLoadingMap = ref<Record<string, boolean>>({});
    const activePanel = ref<ActivePanel>(null);

    const setActivePanel = (panel: ActivePanel) => {
      activePanel.value = panel;
    };

    const fetchData = async (refId: string) => {
      loading.value = true;
      try {
        const data = await aiApi.getTranslationsByRef(refId);
        article.value = data.article;
        translations.value = data.translations;
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
          translations.value = [];
          activePanel.value = null;
        }
      },
      { immediate: true },
    );

    const handleDelete = async (id: string) => {
      const removed = translations.value.find(t => t.id === id);
      await aiApi.deleteTranslation(id);
      translations.value = translations.value.filter(t => t.id !== id);
      toast.success("删除成功");
      if (props.articleId && removed) {
        props.onOptimisticUpdate?.({
          type: "remove",
          articleId: props.articleId,
          translationId: removed.id,
          lang: removed.lang,
        });
      }
      if (
        activePanel.value?.type === "edit"
        && activePanel.value.translation.id === id
      ) {
        activePanel.value = null;
      }
    };

    const handleGenerate = () => {
      if (!props.articleId)
        return;

      const loadingRef = ref(false);
      const langsRef = ref("");

      const $dialog = dialog.create({
        title: "生成 AI 翻译",
        content() {
          return (
            <div class="flex flex-col gap-4">
              <form
                onSubmit={e => e.preventDefault()}
                class="flex flex-col gap-2"
              >
                <label class="text-sm text-neutral-600 mb-2 block dark:text-neutral-400">
                  目标语言（多个语言用逗号分隔，留空使用默认配置）
                </label>
                <NInput
                  value={langsRef.value}
                  onUpdateValue={v => (langsRef.value = v)}
                  placeholder="如：en, ja, ko 或留空"
                />
                <div class="text-right">
                  <NButton
                    attrType="submit"
                    size="small"
                    type="primary"
                    loading={loadingRef.value}
                    onClick={() => {
                      loadingRef.value = true;
                      const targetLanguages = langsRef.value
                        .split(",")
                        .map(l => l.trim().toLowerCase())
                        .filter(l => l.length === 2);

                      const taskPayload = {
                        refId: props.articleId!,
                        targetLanguages:
                          targetLanguages.length > 0
                            ? targetLanguages
                            : undefined,
                      };
                      aiApi
                        .createTranslationTask(taskPayload)
                        .then((res) => {
                          if (res.created) {
                            taskQueue.trackTask({
                              taskId: res.taskId,
                              type: AITaskType.Translation,
                              label: `翻译: ${article.value?.document.title || "文章"}`,
                              onComplete: () => {
                                fetchData(props.articleId!);
                              },
                              retryFn: () =>
                                aiApi.createTranslationTask(taskPayload),
                            });
                            toast.success("已创建翻译任务");
                          } else {
                            toast.info("任务已存在，正在处理中");
                          }
                          $dialog.destroy();
                        })
                        .catch(() => {
                          loadingRef.value = false;
                        })
                        .finally(() => {
                          loadingRef.value = false;
                        });
                    }}
                  >
                    生成
                  </NButton>
                </div>
              </form>
            </div>
          );
        },
      });
    };

    const handleEdit = (item: AITranslation) => {
      setActivePanel({ type: "edit", translation: item });
    };

    const handleSaveEdit = (
      id: string,
      updates: {
        title: string;
        subtitle?: string;
        text: string;
        summary?: string;
        content?: string;
      },
    ) => {
      const idx = translations.value.findIndex(t => t.id === id);
      if (idx !== -1) {
        translations.value[idx].title = updates.title;
        translations.value[idx].subtitle = updates.subtitle;
        translations.value[idx].text = updates.text;
        translations.value[idx].summary = updates.summary;
        if (updates.content !== undefined) {
          translations.value[idx].content = updates.content;
        }
      }
    };

    const handleRegeneration = async (item: AITranslation) => {
      if (regenerationLoadingMap.value[item.id])
        return;
      regenerationLoadingMap.value[item.id] = true;
      try {
        const taskPayload = {
          refId: item.refId,
          targetLanguages: [item.lang],
        };
        const res = await aiApi.createTranslationTask(taskPayload);

        if (res.created) {
          taskQueue.trackTask({
            taskId: res.taskId,
            type: AITaskType.Translation,
            label: `翻译 (${item.lang.toUpperCase()}): ${article.value?.document.title || "文章"}`,
            onComplete: () => {
              fetchData(props.articleId!);
            },
            retryFn: () => aiApi.createTranslationTask(taskPayload),
          });
          toast.success(`已创建 ${item.lang.toUpperCase()} 翻译任务`);
        } else {
          toast.info("任务已存在，正在处理中");
        }
      } finally {
        regenerationLoadingMap.value[item.id] = false;
      }
    };

    const RefIcon = computed(() =>
      article.value ? RefTypeIcons[article.value.type] : FileTextIcon,
    );

    const hasPanel = computed(() => activePanel.value !== null);

    // 左侧内容：文章信息 + 翻译列表
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
              翻译详情
            </h2>
          </div>

          {article.value && (
            <NButton size="small" type="primary" onClick={handleGenerate}>
              {{
                icon: () => <PlusIcon class="size-4" />,
                default: () => "生成翻译",
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
                        翻译列表
                        <span class="text-xs text-neutral-400 ml-1">
                          (
                          {translations.value.length}
                          )
                        </span>
                      </h4>

                      {translations.value.length === 0
                        ? (
                            <NEmpty description="暂无翻译">
                              {{
                                extra: () => (
                                  <NButton size="small" onClick={handleGenerate}>
                                    生成翻译
                                  </NButton>
                                ),
                              }}
                            </NEmpty>
                          )
                        : (
                            <div class="divide-neutral-100 divide-y -mx-4 dark:divide-neutral-800">
                              {translations.value.map(translation => (
                                <TranslationListItem
                                  key={translation.id}
                                  item={translation}
                                  selected={
                                    activePanel.value?.type === "edit"
                                    && activePanel.value.translation.id === translation.id
                                  }
                                  onEdit={() => handleEdit(translation)}
                                  onRegeneration={() => handleRegeneration(translation)}
                                  regenerationLoading={
                                    !!regenerationLoadingMap.value[translation.id]
                                  }
                                  onDelete={() => handleDelete(translation.id)}
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
          <TranslationEditPanel
            translation={activePanel.value.translation}
            onSave={handleSaveEdit}
            onClose={() => setActivePanel(null)}
          />
        );
      }
      return null;
    };

    return () => (
      <SplitPanelLayout
        showPanel={hasPanel.value}
        forceMobile={props.isMobile}
        defaultSize="350px"
        min="300px"
        max="400px"
      >
        {{
          list: ListContent,
          panel: PanelContent,
          empty: () => (
            <SplitPanelEmptyState
              icon={() => <PencilIcon class="text-neutral-400 size-6" />}
              title="选择一条翻译"
              description="从左侧列表选择翻译进行编辑"
            />
          ),
        }}
      </SplitPanelLayout>
    );
  },
});

const TranslationListItem = defineComponent({
  props: {
    item: {
      type: Object as PropType<AITranslation>,
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
    onRegeneration: {
      type: Function as PropType<() => void>,
      required: true,
    },
    regenerationLoading: {
      type: Boolean,
      default: false,
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
            <span class="text-xs text-neutral-400">
              ←
              {" "}
              {props.item.sourceLang.toUpperCase()}
            </span>
          </div>

          <div
            class="opacity-0 flex gap-1 transition-opacity items-center group-hover:opacity-100"
            onClick={e => e.stopPropagation()}
          >
            <NButton
              size="tiny"
              quaternary
              loading={props.regenerationLoading}
              onClick={props.onRegeneration}
            >
              {{
                icon: () => <RotateCwIcon class="size-3.5" />,
              }}
            </NButton>

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
                default: () => "确定要删除这条翻译吗？",
              }}
            </NPopconfirm>
          </div>
        </div>

        <h5 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
          {props.item.title}
        </h5>

        <div class="text-xs text-neutral-500 mt-1 flex gap-3 items-center dark:text-neutral-400">
          <span class="flex gap-1 items-center">
            <CalendarIcon class="size-3" />
            {format(new Date(props.item.createdAt), "MM-dd HH:mm")}
          </span>
          {props.item.aiModel && (
            <span class="flex gap-1 items-center">
              <BotIcon class="size-3" />
              {props.item.aiModel}
            </span>
          )}
        </div>
      </div>
    );
  },
});

const TranslationEditPanel = defineComponent({
  props: {
    translation: {
      type: Object as PropType<AITranslation>,
      required: true,
    },
    onSave: {
      type: Function as PropType<
        (
          id: string,
          updates: {
            title: string;
            subtitle?: string;
            text: string;
            summary?: string;
            content?: string;
          },
        ) => void
      >,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const isLexical = computed(
      () => props.translation.contentFormat === "lexical",
    );

    const titleRef = ref(props.translation.title);
    const subtitleRef = ref(props.translation.subtitle || "");
    const textRef = ref(props.translation.text);
    const summaryRef = ref(props.translation.summary || "");
    const saving = ref(false);

    const richContentRef = ref<SerializedEditorState | undefined>(
      parseRichContent(props.translation.content),
    );
    const editorKey = ref(0);

    watch(
      () => props.translation.id,
      () => {
        titleRef.value = props.translation.title;
        subtitleRef.value = props.translation.subtitle || "";
        textRef.value = props.translation.text;
        summaryRef.value = props.translation.summary || "";
        richContentRef.value = parseRichContent(props.translation.content);
        editorKey.value++;
      },
    );

    const handleSave = async () => {
      if (!titleRef.value) {
        toast.warning("标题不能为空");
        return;
      }
      if (!isLexical.value && !textRef.value) {
        toast.warning("内容不能为空");
        return;
      }
      saving.value = true;
      try {
        const payload: Parameters<typeof aiApi.updateTranslation>[1] = {
          title: titleRef.value,
          subtitle: subtitleRef.value || undefined,
          summary: summaryRef.value || undefined,
        };

        if (isLexical.value) {
          payload.content = richContentRef.value
            ? JSON.stringify(richContentRef.value)
            : undefined;
        } else {
          payload.text = textRef.value;
        }

        await aiApi.updateTranslation(props.translation.id, payload);
        props.onSave(props.translation.id, {
          title: titleRef.value,
          subtitle: subtitleRef.value || undefined,
          text: textRef.value,
          summary: summaryRef.value || undefined,
          content: isLexical.value
            ? JSON.stringify(richContentRef.value)
            : undefined,
        });
        toast.success("保存成功");
        props.onClose();
      } finally {
        saving.value = false;
      }
    };

    const ContentEditor = () => {
      if (isLexical.value) {
        return (
          <div class="border border-neutral-200 rounded-lg min-h-[400px] overflow-hidden dark:border-neutral-800">
            <RichEditor
              key={editorKey.value}
              class="h-full min-h-[400px] w-full"
              editorStyle={
                richEditorStyleOverride as Record<string, string | number>
              }
              initialValue={richContentRef.value}
              variant="article"
              onChange={(value: SerializedEditorState) => {
                richContentRef.value = value;
              }}
              onTextChange={(text: string) => {
                textRef.value = text;
              }}
            />
          </div>
        );
      }

      return (
        <NInput
          value={textRef.value}
          onUpdateValue={v => (textRef.value = v)}
          type="textarea"
          rows={12}
          placeholder="翻译内容"
        />
      );
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
            <div class={["flex items-center gap-2"]}>
              <h2 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
                编辑翻译
              </h2>
              <div class="flex gap-1 items-center">
                <span class="text-xs text-neutral-500">
                  {props.translation.lang.toUpperCase()}
                </span>
                {isLexical.value && (
                  <span class="text-xs text-violet-600 px-1.5 py-0.5 rounded bg-violet-50 dark:text-violet-400 dark:bg-violet-950">
                    Lexical
                  </span>
                )}
              </div>
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
                标题
              </label>
              <NInput
                value={titleRef.value}
                onUpdateValue={v => (titleRef.value = v)}
                placeholder="翻译标题"
              />
            </div>

            <div>
              <label class="text-sm text-neutral-700 font-medium mb-2 block dark:text-neutral-300">
                副标题
                <span class="text-xs text-neutral-400 ml-1">（可选）</span>
              </label>
              <NInput
                value={subtitleRef.value}
                onUpdateValue={v => (subtitleRef.value = v)}
                placeholder="翻译副标题"
              />
            </div>

            <div>
              <label class="text-sm text-neutral-700 font-medium mb-2 block dark:text-neutral-300">
                内容
              </label>
              <ContentEditor />
            </div>

            <div>
              <label class="text-sm text-neutral-700 font-medium mb-2 block dark:text-neutral-300">
                摘要
                <span class="text-xs text-neutral-400 ml-1">（可选）</span>
              </label>
              <NInput
                value={summaryRef.value}
                onUpdateValue={v => (summaryRef.value = v)}
                type="textarea"
                rows={3}
                placeholder="翻译摘要"
              />
            </div>

            {!isLexical.value && (
              <div>
                <label class="text-sm text-neutral-700 font-medium mb-2 block dark:text-neutral-300">
                  预览
                </label>
                <div class="p-4 border border-neutral-200 rounded-lg bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 class="text-base text-neutral-900 font-semibold mb-3 dark:text-neutral-100">
                    {titleRef.value || "无标题"}
                  </h3>
                  <MarkdownRender
                    text={textRef.value || "无内容"}
                    class="text-sm text-neutral-700 leading-relaxed dark:text-neutral-300"
                  />
                  {summaryRef.value && (
                    <div class="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                      <span class="text-xs text-neutral-500 font-medium">
                        摘要
                      </span>
                      <p class="text-sm text-neutral-600 mt-1 dark:text-neutral-400">
                        {summaryRef.value}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {props.translation.tags && props.translation.tags.length > 0 && (
              <div>
                <label class="text-sm text-neutral-700 font-medium mb-2 block dark:text-neutral-300">
                  标签
                </label>
                <div class="flex flex-wrap gap-1">
                  {props.translation.tags.map(tag => (
                    <span
                      key={tag}
                      class="text-xs text-neutral-600 px-2 py-0.5 rounded bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900">
              <h4 class="text-sm text-neutral-700 font-medium mb-3 dark:text-neutral-300">
                元信息
              </h4>
              <div class="text-xs space-y-2">
                <div class="flex gap-2 items-center">
                  <span class="text-neutral-500">创建时间</span>
                  <span class="text-neutral-700 dark:text-neutral-300">
                    {format(
                      new Date(props.translation.createdAt),
                      "yyyy-MM-dd HH:mm:ss",
                    )}
                  </span>
                </div>
                <div class="flex gap-2 items-center">
                  <span class="text-neutral-500">源语言</span>
                  <span class="text-neutral-700 dark:text-neutral-300">
                    {props.translation.sourceLang.toUpperCase()}
                  </span>
                </div>
                {props.translation.aiModel && (
                  <div class="flex gap-2 items-center">
                    <span class="text-neutral-500">AI 模型</span>
                    <span class="text-neutral-700 dark:text-neutral-300">
                      {props.translation.aiModel}
                    </span>
                  </div>
                )}
                {props.translation.aiProvider && (
                  <div class="flex gap-2 items-center">
                    <span class="text-neutral-500">提供商</span>
                    <span class="text-neutral-700 dark:text-neutral-300">
                      {props.translation.aiProvider}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </NScrollbar>
      </div>
    );
  },
});

function parseRichContent(
  content: string | undefined,
): SerializedEditorState | undefined {
  if (!content)
    return undefined;
  try {
    return JSON.parse(content) as SerializedEditorState;
  } catch {
    return undefined;
  }
}

export const TranslationDetailEmptyState = defineComponent({
  name: "TranslationDetailEmptyState",
  setup() {
    return () => (
      <div class="text-center bg-neutral-50 flex flex-col h-full items-center justify-center dark:bg-neutral-950">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <LanguagesIcon class="text-neutral-400 size-8" />
        </div>
        <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">
          选择一篇文章
        </h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          从左侧列表选择文章查看 AI 翻译
        </p>
      </div>
    );
  },
});
