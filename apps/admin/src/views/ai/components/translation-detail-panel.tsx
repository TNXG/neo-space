import type { PropType } from "vue";
import type { AITranslation, ArticleInfo } from "~/api/ai";
import { format } from "date-fns";
import {
  ArrowLeft as ArrowLeftIcon,
  Bot as BotIcon,
  Calendar as CalendarIcon,
  FileText as FileTextIcon,
  Languages as LanguagesIcon,
  Pencil as PencilIcon,
  Save as SaveIcon,
  StickyNote as StickyNoteIcon,
  Trash2 as TrashIcon,
  X as XIcon,
} from "lucide-vue-next";
import { NButton, NEmpty, NInput, NPopconfirm, NScrollbar } from "naive-ui";
import { computed, defineComponent, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";

import { aiApi } from "~/api/ai";
import { SplitPanelEmptyState, SplitPanelLayout } from "~/components/layout";
import { MarkdownRender } from "~/components/markdown/markdown-render";

type ArticleRefType = ArticleInfo["type"];
type ActivePanel = { type: "edit"; translation: AITranslation } | null;
type TranslationUpdates = Pick<AITranslation, "title" | "text" | "summary" | "tags">;

const refTypeIcons: Record<ArticleRefType, typeof FileTextIcon> = {
  posts: FileTextIcon,
  notes: StickyNoteIcon,
  pages: FileTextIcon,
  recently: FileTextIcon,
};

const editRouteByRefType: Partial<Record<ArticleRefType, string>> = {
  posts: "/posts/edit",
  notes: "/notes/edit",
  pages: "/pages/edit",
};

export const TranslationDetailEmptyState = defineComponent({
  name: "TranslationDetailEmptyState",
  setup() {
    return () => (
      <SplitPanelEmptyState
        icon={() => <LanguagesIcon class="text-neutral-400 size-6" />}
        title="选择一篇内容"
        description="从左侧列表查看和编辑已有翻译"
      />
    );
  },
});

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
    onBack: Function as PropType<() => void>,
    onRefresh: Function as PropType<() => void>,
    onOptimisticUpdate: Function as PropType<
      (
        update:
          | { type: "upsert"; article: ArticleInfo; translations: AITranslation[] }
          | {
            type: "remove";
            articleId: string;
            translationId: string;
            lang: string;
          },
      ) => void
    >,
  },
  setup(props) {
    const article = ref<ArticleInfo | null>(null);
    const translations = ref<AITranslation[]>([]);
    const loading = ref(false);
    const activePanel = ref<ActivePanel>(null);

    const fetchData = async (refId: string) => {
      loading.value = true;
      try {
        const data = await aiApi.getTranslationsByRef(refId);
        article.value = data.article;
        translations.value = data.translations;
      } catch {
        article.value = null;
        translations.value = [];
        toast.error("读取翻译失败");
      } finally {
        loading.value = false;
      }
    };

    watch(
      () => props.articleId,
      (articleId) => {
        activePanel.value = null;
        if (articleId) {
          void fetchData(articleId);
        } else {
          article.value = null;
          translations.value = [];
        }
      },
      { immediate: true },
    );

    const handleDelete = async (translationId: string) => {
      const removed = translations.value.find(item => item._id === translationId);
      if (!removed)
        return;

      try {
        await aiApi.deleteTranslation(translationId);
        translations.value = translations.value.filter(item => item._id !== translationId);
        if (props.articleId) {
          props.onOptimisticUpdate?.({
            type: "remove",
            articleId: props.articleId,
            translationId: removed._id,
            lang: removed.lang,
          });
        }
        if (activePanel.value?.translation._id === translationId)
          activePanel.value = null;
        toast.success("删除成功");
      } catch {
        toast.error("删除失败");
      }
    };

    const handleSaveEdit = (translationId: string, updates: TranslationUpdates) => {
      const index = translations.value.findIndex(item => item._id === translationId);
      if (index === -1)
        return;

      translations.value[index] = { ...translations.value[index], ...updates };
      activePanel.value = {
        type: "edit",
        translation: translations.value[index],
      };
      if (article.value) {
        props.onOptimisticUpdate?.({
          type: "upsert",
          article: article.value,
          translations: translations.value,
        });
      }
    };

    const refIcon = computed(() =>
      article.value ? refTypeIcons[article.value.type] : FileTextIcon,
    );
    const editRoute = computed(() =>
      article.value ? editRouteByRefType[article.value.type] : undefined,
    );

    const ArticleTitle = () => {
      if (!article.value)
        return null;

      const RefIcon = refIcon.value;
      const content = (
        <>
          <RefIcon class="text-neutral-400 shrink-0 size-5" />
          <h3 class="text-base text-neutral-900 font-semibold transition-colors dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {article.value.title}
          </h3>
        </>
      );

      return editRoute.value
        ? (
            <RouterLink
              to={`${editRoute.value}?id=${props.articleId}`}
              class="group no-underline inline-flex gap-2 items-center"
            >
              {content}
            </RouterLink>
          )
        : (
            <div class="inline-flex gap-2 items-center">{content}</div>
          );
    };

    const ListContent = () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center dark:border-neutral-800">
          {props.isMobile && props.onBack && (
            <button
              type="button"
              onClick={props.onBack}
              class="text-neutral-500 rounded-md flex size-8 cursor-pointer items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <ArrowLeftIcon class="size-5" />
            </button>
          )}
          <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
            翻译详情
          </h2>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          {loading.value
            ? (
                <div class="py-16 flex items-center justify-center">
                  <div class="border-2 border-neutral-300 border-t-neutral-900 rounded-full size-6 animate-spin dark:border-neutral-700 dark:border-t-white" />
                </div>
              )
            : article.value
              ? (
                  <div class="p-4 space-y-4">
                    <ArticleTitle />
                    <div class="bg-neutral-100 h-px dark:bg-neutral-800" />
                    <div>
                      <h4 class="text-sm text-neutral-700 font-medium mb-3 dark:text-neutral-300">
                        翻译列表
                        <span class="text-xs text-neutral-400 ml-1">
                          ({translations.value.length})
                        </span>
                      </h4>
                      {translations.value.length === 0
                        ? <NEmpty description="暂无翻译" />
                        : (
                            <div class="divide-neutral-100 divide-y -mx-4 dark:divide-neutral-800">
                              {translations.value.map(translation => (
                                <TranslationListItem
                                  key={translation._id}
                                  item={translation}
                                  selected={activePanel.value?.translation._id === translation._id}
                                  onEdit={() => {
                                    activePanel.value = { type: "edit", translation };
                                  }}
                                  onDelete={() => handleDelete(translation._id)}
                                />
                              ))}
                            </div>
                          )}
                    </div>
                  </div>
                )
              : (
                  <div class="py-16">
                    <NEmpty description="未找到对应内容或翻译" />
                  </div>
                )}
        </NScrollbar>
      </div>
    );

    const PanelContent = () => activePanel.value
      ? (
          <TranslationEditPanel
            translation={activePanel.value.translation}
            onSave={handleSaveEdit}
            onClose={() => (activePanel.value = null)}
          />
        )
      : null;

    return () => (
      <SplitPanelLayout
        showPanel={activePanel.value !== null}
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
              ← {props.item.sourceLang.toUpperCase()}
            </span>
          </div>
          <div onClick={event => event.stopPropagation()}>
            <NPopconfirm
              positiveText="取消"
              negativeText="删除"
              onNegativeClick={props.onDelete}
            >
              {{
                trigger: () => (
                  <button
                    type="button"
                    class="text-neutral-500 rounded flex size-7 cursor-pointer transition-colors items-center justify-center dark:text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950"
                  >
                    <TrashIcon class="size-3.5" />
                  </button>
                ),
                default: () => "确定要删除这条翻译吗？",
              }}
            </NPopconfirm>
          </div>
        </div>
        <h5 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
          {props.item.title || props.item.refId}
        </h5>
        <div class="text-xs text-neutral-500 mt-1 flex gap-3 items-center dark:text-neutral-400">
          <span class="flex gap-1 items-center">
            <CalendarIcon class="size-3" />
            {format(new Date(props.item.created), "MM-dd HH:mm")}
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
      type: Function as PropType<(id: string, updates: TranslationUpdates) => void>,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const title = ref(props.translation.title || "");
    const text = ref(props.translation.text || "");
    const summary = ref(props.translation.summary || "");
    const tags = ref((props.translation.tags || []).join(", "));
    const saving = ref(false);

    watch(
      () => props.translation._id,
      () => {
        title.value = props.translation.title || "";
        text.value = props.translation.text || "";
        summary.value = props.translation.summary || "";
        tags.value = (props.translation.tags || []).join(", ");
      },
    );

    const handleSave = async () => {
      if (!text.value.trim()) {
        toast.warning("翻译内容不能为空");
        return;
      }

      const updates: TranslationUpdates = {
        title: title.value.trim() || undefined,
        text: text.value,
        summary: summary.value.trim() || undefined,
        tags: tags.value
          .split(",")
          .map(tag => tag.trim())
          .filter(Boolean),
      };

      saving.value = true;
      try {
        const saved = await aiApi.updateTranslation(props.translation._id, updates);
        props.onSave(saved._id, {
          title: saved.title,
          text: saved.text,
          summary: saved.summary,
          tags: saved.tags,
        });
        toast.success("保存成功");
      } catch {
        toast.error("保存失败");
      } finally {
        saving.value = false;
      }
    };

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-2 items-center">
            <LanguagesIcon class="text-blue-500 size-4" />
            <span class="text-sm font-medium">
              {props.translation.lang.toUpperCase()} 翻译
            </span>
          </div>
          <div class="flex gap-1 items-center">
            <NButton size="tiny" type="primary" loading={saving.value} onClick={handleSave}>
              {{ icon: () => <SaveIcon class="size-3.5" />, default: () => "保存" }}
            </NButton>
            <button
              type="button"
              onClick={props.onClose}
              class="text-neutral-500 rounded flex size-7 cursor-pointer items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <XIcon class="size-4" />
            </button>
          </div>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          <div class="p-4 space-y-4">
            <label class="text-sm font-medium block">
              标题
              <NInput class="mt-1" value={title.value} onUpdateValue={value => (title.value = value)} />
            </label>
            <label class="text-sm font-medium block">
              摘要
              <NInput
                class="mt-1"
                type="textarea"
                autosize={{ minRows: 2, maxRows: 5 }}
                value={summary.value}
                onUpdateValue={value => (summary.value = value)}
              />
            </label>
            <label class="text-sm font-medium block">
              标签
              <NInput
                class="mt-1"
                placeholder="多个标签用逗号分隔"
                value={tags.value}
                onUpdateValue={value => (tags.value = value)}
              />
            </label>
            <label class="text-sm font-medium block">
              内容
              <NInput
                class="mt-1 font-mono"
                type="textarea"
                autosize={{ minRows: 12 }}
                value={text.value}
                onUpdateValue={value => (text.value = value)}
              />
            </label>

            <div>
              <div class="text-sm font-medium mb-2">预览</div>
              <div class="border border-neutral-200 rounded-md p-3 dark:border-neutral-800">
                <MarkdownRender text={text.value || "无内容"} />
              </div>
            </div>

            <div class="text-xs text-neutral-500 flex flex-wrap gap-x-4 gap-y-2 dark:text-neutral-400">
              <span class="flex gap-1 items-center">
                <CalendarIcon class="size-3" />
                {format(new Date(props.translation.created), "yyyy-MM-dd HH:mm")}
              </span>
              {props.translation.aiProvider && (
                <span class="flex gap-1 items-center">
                  <BotIcon class="size-3" />
                  {props.translation.aiProvider}
                  {props.translation.aiModel ? ` / ${props.translation.aiModel}` : ""}
                </span>
              )}
            </div>
          </div>
        </NScrollbar>
      </div>
    );
  },
});
