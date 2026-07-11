import type { PropType } from "vue";
import type {
  BackendPagination,
  TimeCapsuleContent,
  TimeCapsuleContentType,
  TimeSensitivity,
} from "~/api/ai";
import { refDebounced } from "@vueuse/core";
import { format } from "date-fns";
import {
  FileText as FileTextIcon,
  Inbox as InboxIcon,
  LoaderCircle as LoaderIcon,
  Search as SearchIcon,
  StickyNote as StickyNoteIcon,
} from "lucide-vue-next";
import { NPagination, NScrollbar, NSelect, NTag } from "naive-ui";
import { defineComponent, ref, watch } from "vue";

import { BorderlessInput } from "~/components/input/borderless-input";

const typeLabels: Record<TimeCapsuleContentType, string> = {
  post: "文章",
  note: "手记",
  page: "页面",
  recently: "说说",
};

const typeOptions = Object.entries(typeLabels).map(([value, label]) => ({ value, label }));

const sensitivityTone: Record<TimeSensitivity, "error" | "warning" | "success"> = {
  high: "error",
  medium: "warning",
  low: "success",
};

export const TimeCapsuleList = defineComponent({
  name: "TimeCapsuleList",
  props: {
    items: { type: Array as PropType<TimeCapsuleContent[]>, required: true },
    pagination: { type: Object as PropType<BackendPagination | null>, default: null },
    loading: { type: Boolean, default: false },
    selectedId: { type: String as PropType<string | null>, default: null },
    search: { type: String, default: "" },
    contentType: {
      type: String as PropType<TimeCapsuleContentType | null>,
      default: null,
    },
    onSelect: {
      type: Function as PropType<(content: TimeCapsuleContent) => void>,
      required: true,
    },
    onPageChange: { type: Function as PropType<(page: number) => void>, required: true },
    onSearchChange: { type: Function as PropType<(search: string) => void>, required: true },
    onTypeChange: {
      type: Function as PropType<(type: TimeCapsuleContentType | null) => void>,
      required: true,
    },
  },
  setup(props) {
    const searchInput = ref(props.search);
    const debouncedSearch = refDebounced(searchInput, 300);
    watch(debouncedSearch, value => props.onSearchChange(value));

    return () => (
      <div class="flex h-full flex-col">
        <div class="px-3 border-b border-neutral-200 flex h-12 shrink-0 gap-2 items-center dark:border-neutral-800">
          <BorderlessInput
            class="min-w-0 flex-1"
            value={searchInput.value}
            onUpdateValue={value => (searchInput.value = value)}
            placeholder="搜索全部内容"
            clearable
          >
            {{ prefix: () => <SearchIcon class="text-neutral-400 size-4" /> }}
          </BorderlessInput>
          <NSelect
            class="w-24 shrink-0"
            value={props.contentType}
            onUpdateValue={props.onTypeChange}
            options={typeOptions}
            placeholder="全部"
            clearable
            size="small"
          />
        </div>

        <div class="flex-1 min-h-0">
          {props.loading
            ? (
                <div class="flex h-full items-center justify-center">
                  <LoaderIcon class="text-neutral-400 size-6 animate-spin" />
                </div>
              )
            : props.items.length === 0
              ? (
                  <div class="text-neutral-500 flex h-full flex-col items-center justify-center">
                    <InboxIcon class="text-neutral-300 mb-3 size-10" />
                    <p class="text-sm">没有匹配的内容</p>
                  </div>
                )
              : (
                  <NScrollbar class="h-full">
                    {props.items.map((item) => {
                      const ItemIcon = item.type === "note" ? StickyNoteIcon : FileTextIcon;
                      const latestCapsules = [...item.capsules]
                        .sort((left, right) => right.created.localeCompare(left.created))
                        .filter((capsule, index, capsules) =>
                          capsules.findIndex(value => value.lang === capsule.lang) === index,
                        );
                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => props.onSelect(item)}
                          class={[
                            "text-left border-b border-neutral-100 px-4 py-3 w-full cursor-pointer transition-colors dark:border-neutral-800/60",
                            props.selectedId === item._id
                              ? "bg-neutral-100 dark:bg-neutral-800"
                              : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
                          ]}
                        >
                          <div class="flex gap-2 items-start">
                            <ItemIcon class="text-neutral-400 mt-0.5 size-4 shrink-0" />
                            <span class="text-sm text-neutral-900 font-medium line-clamp-2 dark:text-neutral-100">
                              {item.title}
                            </span>
                          </div>
                          <div class="text-xs text-neutral-400 mt-2 pl-6 flex flex-wrap gap-1.5 items-center">
                            <span>{typeLabels[item.type]}</span>
                            <span>{format(new Date(item.created), "yyyy-MM-dd")}</span>
                            <span>
                              {latestCapsules.length}
                              /
                              {item.availableLanguages.length}
                              已分析
                            </span>
                            {latestCapsules.length === 0
                              ? <span class="text-neutral-400">未分析</span>
                              : latestCapsules.map(capsule => (
                                  <NTag
                                    key={capsule.lang}
                                    size="tiny"
                                    type={sensitivityTone[capsule.sensitivity]}
                                    bordered={false}
                                  >
                                    {capsule.lang.toUpperCase()}
                                  </NTag>
                                ))}
                          </div>
                        </button>
                      );
                    })}
                  </NScrollbar>
                )}
        </div>

        {props.pagination && props.pagination.total_page > 1 && (
          <div class="px-3 border-t border-neutral-200 flex h-12 shrink-0 items-center justify-center dark:border-neutral-800">
            <NPagination
              page={props.pagination.current_page}
              pageCount={props.pagination.total_page}
              onUpdatePage={props.onPageChange}
              size="small"
            />
          </div>
        )}
      </div>
    );
  },
});
