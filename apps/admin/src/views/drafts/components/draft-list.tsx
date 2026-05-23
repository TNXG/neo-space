import type { PropType } from "vue";
import type { DraftModel } from "~/models/draft";
import {
  ChevronDown as ChevronDownIcon,
  Inbox as InboxIcon,
} from "lucide-vue-next";
import { NPopover, NScrollbar } from "naive-ui";
import { computed, defineComponent } from "vue";

import { DraftRefType } from "~/models/draft";

import { DraftListItem } from "./draft-list-item";

const FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: DraftRefType.Post, label: "文章" },
  { value: DraftRefType.Note, label: "手记" },
  { value: DraftRefType.Page, label: "页面" },
];

export const DraftList = defineComponent({
  name: "DraftList",
  props: {
    data: {
      type: Array as PropType<DraftModel[]>,
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
    filterValue: {
      type: String as PropType<DraftRefType | "all">,
      default: "all",
    },
    onSelect: {
      type: Function as PropType<(draft: DraftModel) => void>,
      required: true,
    },
    onFilterChange: {
      type: Function as PropType<(value: DraftRefType | "all") => void>,
      required: true,
    },
  },
  setup(props) {
    const currentFilterLabel = computed(
      () =>
        FILTER_OPTIONS.find(o => o.value === props.filterValue)?.label
        || "全部",
    );

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex h-12 items-center justify-between dark:border-neutral-800">
          <NPopover
            trigger="click"
            placement="bottom-start"
            internalExtraClass={["headless"]}
            showArrow={false}
            contentClass="bg-white dark:bg-neutral-900 rounded overflow-hidden"
          >
            {{
              trigger: () => (
                <button class="text-base text-neutral-900 font-semibold flex gap-1.5 items-center dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-300">
                  {currentFilterLabel.value}
                  <ChevronDownIcon class="h-4 w-4" />
                </button>
              ),
              default: () => (
                <div class="py-1 min-w-[120px]">
                  {FILTER_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => props.onFilterChange(option.value as any)}
                      class={[
                        "w-full px-3 py-1.5 text-left transition-colors",
                        props.filterValue === option.value
                          ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                          : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800/50",
                      ]}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ),
            }}
          </NPopover>

          {props.data.length > 0 && (
            <span class="text-xs text-neutral-400">
              {props.data.length}
              {" "}
              个
            </span>
          )}
        </div>

        <div class="flex-1 min-h-0">
          {props.loading
            ? (
                <div class="py-24 flex items-center justify-center">
                  <div class="border-2 border-neutral-300 border-t-neutral-900 rounded-full h-6 w-6 animate-spin dark:border-neutral-700 dark:border-t-white" />
                </div>
              )
            : props.data.length === 0
              ? (
                  <div class="py-24 text-center flex flex-col items-center justify-center">
                    <InboxIcon class="text-neutral-300 mb-4 h-10 w-10 dark:text-neutral-700" />
                    <p class="text-sm text-neutral-500">暂无草稿</p>
                    <p class="text-xs text-neutral-400 mt-1">
                      草稿会在编辑时自动保存到这里
                    </p>
                  </div>
                )
              : (
                  <NScrollbar class="h-full">
                    <div>
                      {props.data.map(item => (
                        <DraftListItem
                          key={item._id}
                          data={item}
                          selected={props.selectedId === item._id}
                          onSelect={() => props.onSelect(item)}
                        />
                      ))}
                    </div>
                  </NScrollbar>
                )}
        </div>
      </div>
    );
  },
});
