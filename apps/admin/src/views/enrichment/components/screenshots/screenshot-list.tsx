import type { PropType } from "vue";
import type {
  EnrichmentScreenshotJoinedRow,
  EnrichmentScreenshotQuota,
} from "~/models/enrichment";
import { useQuery } from "@tanstack/vue-query";
import { Loader2 as LoaderIcon } from "lucide-vue-next";
import { NScrollbar, NSelect } from "naive-ui";

import { computed, defineComponent } from "vue";

import { enrichmentApi } from "~/api/enrichment";
import { CompactPagination } from "~/components/pagination/compact-pagination";
import { queryKeys } from "~/hooks/queries/keys";

import { ScreenshotEmptyState } from "./screenshot-empty-state";
import { ScreenshotListItem } from "./screenshot-list-item";
import { ScreenshotQuotaChip } from "./screenshot-quota-chip";

export type ScreenshotSort = "last_accessed" | "created" | "bytes";
export type ScreenshotOrder = "asc" | "desc";

const sortOptions = [
  { label: "最近访问", value: "last_accessed" },
  { label: "创建时间", value: "created" },
  { label: "大小", value: "bytes" },
];
const orderOptions = [
  { label: "降序", value: "desc" },
  { label: "升序", value: "asc" },
];

export const ScreenshotList = defineComponent({
  name: "ScreenshotList",
  props: {
    page: { type: Number, required: true },
    pageSize: { type: Number, required: true },
    sort: { type: String as PropType<ScreenshotSort>, required: true },
    order: { type: String as PropType<ScreenshotOrder>, required: true },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    quota: {
      type: Object as PropType<EnrichmentScreenshotQuota | null>,
      default: null,
    },
    onSelect: {
      type: Function as PropType<(row: EnrichmentScreenshotJoinedRow) => void>,
      required: true,
    },
    onPageChange: {
      type: Function as PropType<(page: number) => void>,
      required: true,
    },
    onPageSizeChange: {
      type: Function as PropType<(size: number) => void>,
      required: true,
    },
    onSortChange: {
      type: Function as PropType<(sort: ScreenshotSort) => void>,
      required: true,
    },
    onOrderChange: {
      type: Function as PropType<(order: ScreenshotOrder) => void>,
      required: true,
    },
  },
  setup(props) {
    const params = computed(() => ({
      page: props.page,
      size: props.pageSize,
      sort: props.sort,
      order: props.order,
    }));

    const { data, isPending, isFetching } = useQuery({
      queryKey: computed(() =>
        queryKeys.enrichment.screenshots.list(params.value),
      ),
      queryFn: () => enrichmentApi.screenshots.list(params.value),
      placeholderData: prev => prev,
    });

    const rows = computed<EnrichmentScreenshotJoinedRow[]>(
      () => data.value?.data || [],
    );
    const pageCount = computed(() => data.value?.pagination.totalPage || 1);

    return () => (
      <div class="flex flex-col h-full min-h-0">
        <div class="px-4 py-2 border-b border-neutral-200 flex shrink-0 flex-wrap gap-2 items-center justify-between dark:border-neutral-800">
          <ScreenshotQuotaChip quota={props.quota} />
          <div class="flex gap-1.5 items-center">
            <NSelect
              size="tiny"
              value={props.sort}
              options={sortOptions}
              onUpdateValue={(v: ScreenshotSort) => props.onSortChange(v)}
              class="w-24"
            />
            <NSelect
              size="tiny"
              value={props.order}
              options={orderOptions}
              onUpdateValue={(v: ScreenshotOrder) => props.onOrderChange(v)}
              class="w-20"
            />
          </div>
        </div>

        <div class="flex-1 min-h-0">
          {isPending.value && rows.value.length === 0
            ? (
                <div class="py-16 flex items-center justify-center">
                  <LoaderIcon class="text-neutral-400 size-5 animate-spin" />
                </div>
              )
            : rows.value.length === 0
              ? (
                  <ScreenshotEmptyState />
                )
              : (
                  <NScrollbar class="h-full">
                    <div class="p-3 gap-2 grid grid-cols-1 sm:grid-cols-2">
                      {rows.value.map(row => (
                        <ScreenshotListItem
                          key={row.enrichmentId}
                          row={row}
                          selected={props.selectedId === row.enrichmentId}
                          onSelect={() => props.onSelect(row)}
                        />
                      ))}
                    </div>
                    {isFetching.value && rows.value.length > 0 && (
                      <div class="pb-2 flex items-center justify-center">
                        <LoaderIcon class="text-neutral-400 size-4 animate-spin" />
                      </div>
                    )}
                  </NScrollbar>
                )}
        </div>

        {pageCount.value > 1 && (
          <div class="px-3 py-1.5 border-t border-neutral-200 flex shrink-0 items-center justify-end dark:border-neutral-800">
            <CompactPagination
              page={props.page}
              pageCount={pageCount.value}
              pageSize={props.pageSize}
              pageSizes={[10, 20, 50]}
              onPageChange={p => props.onPageChange(p)}
              onPageSizeChange={s => props.onPageSizeChange(s)}
            />
          </div>
        )}
      </div>
    );
  },
});
