import {
  ChevronRight as NextIcon,
  ChevronLeft as PrevIcon,
} from 'lucide-vue-next'
import { NPopselect } from 'naive-ui'
import { computed, defineComponent } from 'vue'
import type { PropType } from 'vue'

export const CompactPagination = defineComponent({
  name: 'CompactPagination',
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
      props.pageSizes.map((s) => ({ label: `${s} / 页`, value: s })),
    )
    const canPrev = computed(() => props.page > 1)
    const canNext = computed(() => props.page < props.pageCount)

    return () => (
      <div class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
        <button
          type="button"
          disabled={!canPrev.value}
          class="flex size-6 items-center justify-center rounded transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
          onClick={() => canPrev.value && props.onPageChange(props.page - 1)}
        >
          <PrevIcon class="size-3.5" aria-hidden="true" />
        </button>
        <span class="px-1 tabular-nums">
          <span class="text-neutral-900 dark:text-neutral-100">
            {props.page}
          </span>
          <span class="mx-1 text-neutral-300 dark:text-neutral-600">/</span>
          <span>{props.pageCount}</span>
        </span>
        <button
          type="button"
          disabled={!canNext.value}
          class="flex size-6 items-center justify-center rounded transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
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
            class="ml-1 rounded px-1.5 py-0.5 tabular-nums transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {props.pageSize}/页
          </button>
        </NPopselect>
      </div>
    )
  },
})
