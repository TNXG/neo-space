import { Image as ImageIcon } from 'lucide-vue-next'
import { defineComponent, ref } from 'vue'
import type { EnrichmentScreenshotJoinedRow } from '~/models/enrichment'
import type { PropType } from 'vue'

import { RelativeTime } from '~/components/time/relative-time'

import { formatBytes } from '../../utils'

export const ScreenshotListItem = defineComponent({
  name: 'ScreenshotListItem',
  props: {
    row: {
      type: Object as PropType<EnrichmentScreenshotJoinedRow>,
      required: true,
    },
    selected: { type: Boolean, default: false },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const errored = ref(false)
    return () => {
      const { row } = props
      const showImg = !!row.publicUrl && !errored.value
      return (
        <button
          type="button"
          onClick={props.onSelect}
          class={[
            'group flex flex-col gap-1.5 overflow-hidden rounded-md border bg-white p-1.5 text-left transition-colors dark:bg-neutral-900',
            props.selected
              ? 'border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100'
              : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
          ]}
        >
          <div class="relative aspect-video w-full overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
            {showImg ? (
              <img
                src={row.publicUrl}
                alt={row.title || row.url}
                loading="lazy"
                class="size-full object-cover transition-transform group-hover:scale-[1.02]"
                onError={() => (errored.value = true)}
              />
            ) : (
              <div class="flex size-full items-center justify-center">
                <ImageIcon class="size-6 text-neutral-300 dark:text-neutral-600" />
              </div>
            )}
          </div>
          <div class="flex flex-col gap-0.5 px-0.5">
            <span class="line-clamp-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">
              {row.title || row.url}
            </span>
            <div class="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
              <span class="tabular-nums">
                {row.width}×{row.height}
              </span>
              <span class="tabular-nums">{formatBytes(row.bytes)}</span>
            </div>
            <div class="text-[11px] text-neutral-400">
              <RelativeTime time={new Date(row.lastAccessedAt)} />
            </div>
          </div>
        </button>
      )
    }
  },
})
