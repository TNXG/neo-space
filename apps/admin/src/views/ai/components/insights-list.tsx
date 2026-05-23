import type { PropType } from "vue";
import type { ArticleInfo, GroupedInsightsData } from "~/api/ai";
import { refDebounced } from "@vueuse/core";
import {
  FileText as FileTextIcon,
  Inbox as InboxIcon,
  LoaderIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  StickyNote as StickyNoteIcon,
} from "lucide-vue-next";
import { NButton, NScrollbar, NTooltip } from "naive-ui";

import { computed, defineComponent, ref, watch } from "vue";

import { BorderlessInput } from "~/components/input/borderless-input";

import { InsightsArticleSelectorModal } from "./insights-article-selector-modal";

type ArticleRefType = ArticleInfo["type"];

const RefTypeLabels: Record<ArticleRefType, string> = {
  Post: "文章",
  Note: "笔记",
  Page: "页面",
  Recently: "速记",
};

const RefTypeIcons: Record<ArticleRefType, typeof FileTextIcon> = {
  Post: FileTextIcon,
  Note: StickyNoteIcon,
  Page: FileTextIcon,
  Recently: FileTextIcon,
};

interface Pager {
  currentPage: number;
  totalPage: number;
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export const InsightsList = defineComponent({
  name: "InsightsList",
  props: {
    data: {
      type: Array as PropType<GroupedInsightsData[]>,
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
    const showBatchModal = ref(false);
    const searchInputValue = ref("");
    const debouncedSearch = refDebounced(searchInputValue, 300);

    watch(debouncedSearch, (val) => {
      props.onSearchChange?.(val);
    });

    const handleBatchSuccess = () => {
      props.onRefresh?.();
    };

    const showSearchEmpty = computed(
      () => props.search.trim().length > 0 && props.data.length === 0,
    );

    const handleScroll = (event: Event) => {
      if (props.loading || !props.pager?.hasNextPage)
        return;
      const target = event.target as HTMLElement;
      if (!target)
        return;
      const reachedBottom
        = target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
      if (reachedBottom) {
        props.onPageChange?.(props.pager.currentPage + 1);
      }
    };

    return () => (
      <div class="flex flex-col h-full">
        <InsightsArticleSelectorModal
          show={showBatchModal.value}
          onClose={() => (showBatchModal.value = false)}
          onSuccess={handleBatchSuccess}
        />

        <div class="px-4 py-2 border-b border-neutral-200 flex flex-shrink-0 gap-2 h-12 items-center dark:border-neutral-800">
          <BorderlessInput
            class="flex-1 -mx-4"
            value={searchInputValue.value}
            onUpdateValue={val => (searchInputValue.value = val)}
            placeholder="输入文章标题关键词"
            clearable
            inputProps={{
              id: "ai-insights-search",
              name: "ai-insights-search",
              autocomplete: "off",
              class: "text-base",
            }}
          >
            {{
              prefix: () => <SearchIcon class="text-neutral-400 size-4" />,
            }}
          </BorderlessInput>

          <NTooltip>
            {{
              trigger: () => (
                <NButton
                  size="tiny"
                  quaternary
                  circle
                  onClick={() => (showBatchModal.value = true)}
                >
                  <PlusIcon class="size-4" />
                </NButton>
              ),
              default: () => "批量生成精读",
            }}
          </NTooltip>
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
                    <p class="text-sm text-neutral-500">暂无精读</p>
                    <p class="text-xs text-neutral-400 mt-1">
                      为文章生成 AI 精读后会显示在这里
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
                          <InsightsListItem
                            key={group.article.id}
                            article={group.article}
                            insightsCount={group.insights.length}
                            selected={props.selectedId === group.article.id}
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

const InsightsListItem = defineComponent({
  name: "InsightsListItem",
  props: {
    article: {
      type: Object as PropType<ArticleInfo>,
      required: true,
    },
    insightsCount: {
      type: Number,
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
            {props.insightsCount}
            {" "}
            条精读
          </span>
        </div>
      </div>
    );
  },
});
