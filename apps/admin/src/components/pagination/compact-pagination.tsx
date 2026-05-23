import type { PropType } from "vue";
import {
  ChevronRight as NextIcon,
  ChevronLeft as PrevIcon,
} from "lucide-vue-next";
import { NPopselect } from "naive-ui";
import { computed, defineComponent } from "vue";

export const CompactPagination = defineComponent({
  name: "CompactPagination",
  props: {
    page: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    pageSize: { type: Number, required: true },
    pageSizes: {
      type: Array as PropType<number[]>,
      default: () => [10, 20, 50, 100],
    },
    onPageChange: {
      type: Function as PropType<(p: number) => void>,
      required: true,
    },
    onPageSizeChange: {
      type: Function as PropType<(s: number) => void>,
      required: true,
    },
  },
  setup(props) {
    const sizeOptions = computed(() =>
      props.pageSizes.map(s => ({ label: `${s} / 页`, value: s })),
    );
    const canPrev = computed(() => props.page > 1);
    const canNext = computed(() => props.page < props.pageCount);

    return () => (
      <div class="text-xs text-neutral-500 flex gap-1 items-center dark:text-neutral-400">
        <button
          type="button"
          disabled={!canPrev.value}
          class="rounded flex size-6 transition-colors items-center justify-center hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800 disabled:hover:bg-transparent"
          onClick={() => canPrev.value && props.onPageChange(props.page - 1)}
        >
          <PrevIcon class="size-3.5" aria-hidden="true" />
        </button>
        <span class="px-1 tabular-nums">
          <span class="text-neutral-900 dark:text-neutral-100">
            {props.page}
          </span>
          <span class="text-neutral-300 mx-1 dark:text-neutral-600">/</span>
          <span>{props.pageCount}</span>
        </span>
        <button
          type="button"
          disabled={!canNext.value}
          class="rounded flex size-6 transition-colors items-center justify-center hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800 disabled:hover:bg-transparent"
          onClick={() => canNext.value && props.onPageChange(props.page + 1)}
        >
          <NextIcon class="size-3.5" aria-hidden="true" />
        </button>
        <NPopselect
          value={props.pageSize}
          options={sizeOptions.value}
          onUpdateValue={(v: number) => props.onPageSizeChange(v)}
          trigger="click"
          size="small"
        >
          <button
            type="button"
            class="ml-1 px-1.5 py-0.5 rounded transition-colors tabular-nums hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {props.pageSize}
            /页
          </button>
        </NPopselect>
      </div>
    );
  },
});
