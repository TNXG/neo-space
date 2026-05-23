import type { PropType } from "vue";
import type { CommentModel } from "~/models/comment";
import {
  ChevronDown as ChevronDownIcon,
  Inbox as InboxIcon,
} from "lucide-vue-next";
import { NCheckbox, NPagination, NPopover, NScrollbar } from "naive-ui";
import { computed, defineComponent } from "vue";

import { CommentListItem } from "./comment-list-item";

interface Pager {
  currentPage: number;
  totalPage: number;
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

const FILTER_OPTIONS = [
  { value: 0, label: "待审核" },
  { value: 1, label: "已读" },
  { value: 2, label: "垃圾桶" },
];

export const CommentList = defineComponent({
  name: "CommentList",
  props: {
    data: {
      type: Array as PropType<CommentModel[]>,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    checkedKeys: {
      type: Array as PropType<string[]>,
      required: true,
    },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    pager: {
      type: Object as PropType<Pager | null>,
      default: null,
    },
    selectAllMode: {
      type: Boolean,
      default: false,
    },
    filterValue: {
      type: Number,
      default: 0,
    },
    onCheck: {
      type: Function as PropType<(id: string, checked: boolean) => void>,
      required: true,
    },
    onCheckAll: {
      type: Function as PropType<(checked: boolean) => void>,
      required: true,
    },
    onSelectAll: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onSelect: {
      type: Function as PropType<(comment: CommentModel) => void>,
      required: true,
    },
    onPageChange: {
      type: Function as PropType<(page: number) => void>,
      required: true,
    },
    onFilterChange: {
      type: Function as PropType<(value: number) => void>,
      required: true,
    },
  },
  setup(props) {
    const isAllChecked = computed(() => {
      return (
        props.data.length > 0 && props.checkedKeys.length === props.data.length
      );
    });

    const isIndeterminate = computed(() => {
      return (
        props.checkedKeys.length > 0
        && props.checkedKeys.length < props.data.length
      );
    });

    const totalCount = computed(() => props.pager?.total ?? 0);
    const hasMultiplePages = computed(
      () => props.pager && props.pager.totalPage > 1,
    );
    const showSelectAllHint = computed(
      () =>
        isAllChecked.value && hasMultiplePages.value && !props.selectAllMode,
    );

    const currentFilterLabel = computed(
      () =>
        FILTER_OPTIONS.find(o => o.value === props.filterValue)?.label
        || "待审核",
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
                      onClick={() => props.onFilterChange(option.value)}
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

          {totalCount.value > 0 && (
            <span class="text-xs text-neutral-400">
              {totalCount.value}
              {" "}
              条
            </span>
          )}
        </div>

        {props.data.length > 0 && (
          <div class="px-4 py-2 border-b border-neutral-200 bg-neutral-50/50 flex flex-wrap gap-x-3 gap-y-1 items-center dark:border-neutral-800 dark:bg-neutral-900/50">
            <NCheckbox
              checked={isAllChecked.value}
              indeterminate={isIndeterminate.value}
              onUpdateChecked={props.onCheckAll}
              size="small"
            />
            <span class="text-sm text-neutral-500">
              {props.selectAllMode
                ? `已选全部 ${totalCount.value} 条`
                : props.checkedKeys.length > 0
                  ? `已选 ${props.checkedKeys.length} 项`
                  : "全选"}
            </span>
            {showSelectAllHint.value && (
              <button
                onClick={props.onSelectAll}
                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline dark:hover:text-blue-300"
              >
                选择全部
                {" "}
                {totalCount.value}
                {" "}
                条
              </button>
            )}
          </div>
        )}

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
                    <p class="text-sm text-neutral-500">暂无评论</p>
                  </div>
                )
              : (
                  <NScrollbar class="h-full">
                    <div>
                      {props.data.map(item => (
                        <CommentListItem
                          key={item.id}
                          data={item}
                          checked={props.checkedKeys.includes(item.id)}
                          selected={props.selectedId === item.id}
                          onCheck={c => props.onCheck(item.id, c)}
                          onSelect={() => props.onSelect(item)}
                        />
                      ))}
                    </div>
                  </NScrollbar>
                )}
        </div>

        {props.pager && props.pager.totalPage > 1 && (
          <div class="px-4 py-3 border-t border-neutral-200 bg-neutral-50/50 flex items-center justify-end dark:border-neutral-800 dark:bg-neutral-900/50">
            <NPagination
              page={props.pager.currentPage}
              pageCount={props.pager.totalPage}
              onUpdatePage={props.onPageChange}
              simple
            />
          </div>
        )}
      </div>
    );
  },
});
