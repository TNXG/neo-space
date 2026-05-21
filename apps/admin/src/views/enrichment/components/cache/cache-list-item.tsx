import { AlertTriangle as FailureIcon } from 'lucide-vue-next'
import { NTag } from 'naive-ui'
import { defineComponent } from 'vue'
import type { EnrichmentRow } from '~/models/enrichment'
import type { PropType } from 'vue'

import { RelativeTime } from '~/components/time/relative-time'

export const CacheListItem = defineComponent({
  name: 'CacheListItem',
  props: {
    row: {
      type: Object as PropType<EnrichmentRow>,
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
    return () => {
      const { row } = props
      const hasFailures = row.failureCount > 0
      const subtitle = [row.normalized.category, row.normalized.subtype]
        .filter(Boolean)
        .join(' · ')
      return (
        <div
          class={[
            'flex cursor-pointer items-start gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 dark:border-neutral-800/50',
            props.selected
              ? 'bg-neutral-100 dark:bg-neutral-800'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30',
          ]}
          onClick={props.onSelect}
        >
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="flex items-center gap-1.5">
              <NTag size="small" type="info">
                {row.provider}
              </NTag>
              {subtitle && (
                <span class="truncate text-xs text-neutral-400">
                  {subtitle}
                </span>
              )}
            </div>

            <h3 class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {row.normalized.title || row.url}
            </h3>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-1 text-xs">
            {row.locale ? (
              <NTag size="small" type="default">
                {row.locale}
              </NTag>
            ) : (
              <span class="text-neutral-400">默认</span>
            )}
            <span class="text-neutral-500">
              <RelativeTime time={new Date(row.fetchedAt)} />
            </span>
            {hasFailures && (
              <span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500">
                <FailureIcon class="size-3" aria-hidden="true" />
                {row.failureCount}
              </span>
            )}
          </div>
        </div>
      )
    }
  },
})
