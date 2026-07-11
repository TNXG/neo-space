import type { PropType } from "vue";
import type { ArticleInfo, GroupedTranslationData } from "~/api/ai";
import { refDebounced } from "@vueuse/core";
import {
  FileText as FileTextIcon,
  Inbox as InboxIcon,
  LoaderIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  StickyNote as StickyNoteIcon,
} from "lucide-vue-next";
import { NButton, NInput, NScrollbar, NSelect } from "naive-ui";

import { computed, defineComponent, ref, watch } from "vue";

import { aiApi } from "~/api/ai";
import { BorderlessInput } from "~/components/input/borderless-input";

type ArticleRefType = ArticleInfo["type"];

const RefTypeLabels: Record<ArticleRefType, string> = {
  posts: "文章",
  notes: "笔记",
  pages: "页面",
  recently: "速记",
};

const RefTypeIcons: Record<ArticleRefType, typeof FileTextIcon> = {
  posts: FileTextIcon,
  notes: StickyNoteIcon,
  pages: FileTextIcon,
  recently: FileTextIcon,
};

interface Pager {
  current_page: number;
  total_page: number;
  total: number;
  has_prev_page: boolean;
  has_next_page: boolean;
}

export const TranslationList = defineComponent({
  name: "TranslationList",
  props: {
    data: {
      type: Array as PropType<GroupedTranslationData[]>,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    pager: {
      type: Object as PropType<Pager | null>,
      default: null,
    },
    onSelect: {
      type: Function as PropType<(article: ArticleInfo) => void>,
      required: true,
    },
    onPageChange: {
      type: Function as PropType<(page: number) => void>,
    },
    onRefresh: {
      type: Function as PropType<() => void>,
    },
    onSearchChange: {
      type: Function as PropType<(search: string) => void>,
    },
    search: {
      type: String,
      default: "",
    },
  },
  setup(props) {
    const searchInputValue = ref("");
    const debouncedSearch = refDebounced(searchInputValue, 300);

    const handleGenerate = () => {
      const refId = ref("");
      const refType = ref<ArticleRefType>("posts");
      const targetLanguages = ref("en");
      const currentDialog = dialog.create({
        title: "生成内容翻译",
        content: () => (
          <div class="flex flex-col gap-3">
            <NSelect
              value={refType.value}
              onUpdateValue={value => (refType.value = value)}
              options={Object.entries(RefTypeLabels).map(([value, label]) => ({ value, label }))}
            />
            <NInput
              value={refId.value}
              onUpdateValue={value => (refId.value = value)}
              placeholder="内容 _id"
            />
            <NInput
              value={targetLanguages.value}
              onUpdateValue={value => (targetLanguages.value = value)}
              placeholder="目标语言，如 en, ja"
            />
          </div>
        ),
        positiveText: "生成",
        negativeText: "取消",
        onPositiveClick: async () => {
          const languages = targetLanguages.value
            .split(",")
            .map(language => language.trim().toLowerCase())
            .filter(Boolean);
          if (!refId.value.trim() || languages.length === 0) {
            window.$message.warning("请填写内容 _id 和目标语言");
            return false;
          }
          try {
            await aiApi.generateTranslations({
              refId: refId.value.trim(),
              refType: refType.value,
              targetLanguages: languages,
            });
            window.$message.success("翻译生成成功");
            props.onRefresh?.();
            currentDialog.destroy();
          } catch {
            window.$message.error("翻译生成失败");
            return false;
          }
        },
      });
    };

    watch(debouncedSearch, (val) => {
      props.onSearchChange?.(val);
    });

    const showSearchEmpty = computed(
      () => props.search.trim().length > 0 && props.data.length === 0,
    );

    const handleScroll = (event: Event) => {
      if (props.loading || !props.pager?.has_next_page)
        return;
      const target = event.target as HTMLElement;
      if (!target)
        return;
      const reachedBottom
        = target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
      if (reachedBottom) {
        props.onPageChange?.(props.pager.current_page + 1);
      }
    };

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 py-2 border-b border-neutral-200 flex flex-shrink-0 gap-2 h-12 items-center dark:border-neutral-800">
          <BorderlessInput
            class="flex-1"
            value={searchInputValue.value}
            onUpdateValue={val => (searchInputValue.value = val)}
            placeholder="输入文章标题关键词"
            clearable
            inputProps={{
              id: "ai-translation-search",
              name: "ai-translation-search",
              autocomplete: "off",
              class: "text-base",
            }}
          >
            {{
              prefix: () => <SearchIcon class="text-neutral-400 size-4" />,
            }}
          </BorderlessInput>
          <NButton size="small" type="primary" onClick={handleGenerate}>
            {{ icon: () => <PlusIcon class="size-4" />, default: () => "生成" }}
          </NButton>
        </div>

        <div class="flex-1 min-h-0">
          {props.loading && props.data.length === 0
            ? (
                <div class="py-24 flex items-center justify-center">
                  <LoaderIcon class="text-neutral-400 size-6 animate-spin dark:text-neutral-500" />
                </div>
              )
            : props.data.length === 0
              ? (
                  <div class="py-24 text-center flex flex-col items-center justify-center">
                    <InboxIcon class="text-neutral-300 mb-4 h-10 w-10 dark:text-neutral-700" />
                    <p class="text-sm text-neutral-500">暂无 AI 翻译</p>
                    <p class="text-xs text-neutral-400 mt-1">
                      为文章生成 AI 翻译后会显示在这里
                    </p>
                  </div>
                )
              : showSearchEmpty.value
                ? (
                    <div class="py-24 text-center flex flex-col items-center justify-center">
                      <InboxIcon class="text-neutral-300 mb-4 h-10 w-10 dark:text-neutral-700" />
                      <p class="text-sm text-neutral-500">没有找到匹配的文章</p>
                      <p class="text-xs text-neutral-400 mt-1">试试其他关键词</p>
                    </div>
                  )
                : (
                    <NScrollbar class="h-full" onScroll={handleScroll}>
                      <div>
                        {props.data.map(group => (
                          <TranslationListItem
                            key={group.article._id}
                            article={group.article}
                            translationCount={group.translations.length}
                            languages={group.translations.map(t => t.lang)}
                            selected={props.selectedId === group.article._id}
                            onSelect={() => props.onSelect(group.article)}
                          />
                        ))}
                        {props.loading && props.data.length > 0 && (
                          <div class="py-3 flex items-center justify-center">
                            <LoaderIcon class="text-neutral-400 size-4 animate-spin dark:text-neutral-500" />
                          </div>
                        )}
                      </div>
                    </NScrollbar>
                  )}
        </div>
      </div>
    );
  },
});

const TranslationListItem = defineComponent({
  name: "TranslationListItem",
  props: {
    article: {
      type: Object as PropType<ArticleInfo>,
      required: true,
    },
    translationCount: {
      type: Number,
      required: true,
    },
    languages: {
      type: Array as PropType<string[]>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const RefIcon = computed(() => RefTypeIcons[props.article.type]);

    return () => (
      <div
        class={[
          "cursor-pointer border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 dark:border-neutral-800/50",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        ]}
        onClick={props.onSelect}
      >
        <div class="flex gap-2 items-center">
          <RefIcon.value class="text-neutral-400 shrink-0 size-4" />
          <h3 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
            {props.article.title}
          </h3>
        </div>

        <div class="text-xs text-neutral-400 mt-1.5 pl-6 flex gap-2 items-center">
          <span class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
            {RefTypeLabels[props.article.type]}
          </span>
          <span>
            {props.translationCount}
            {" "}
            种语言
          </span>
          <div class="flex gap-1">
            {props.languages.slice(0, 3).map(lang => (
              <span
                key={lang}
                class="text-blue-600 px-1 py-0.5 rounded bg-blue-50 dark:text-blue-400 dark:bg-blue-950"
              >
                {lang.toUpperCase()}
              </span>
            ))}
            {props.languages.length > 3 && (
              <span class="text-neutral-400">
                +
                {props.languages.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
});
