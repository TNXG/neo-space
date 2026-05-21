import { NTag } from 'naive-ui'
import { defineComponent } from 'vue'
import type { SearchDocumentAdminRow } from '~/models/search-index'
import type { PropType } from 'vue'

import { RelativeTime } from '~/components/time/relative-time'

import { refTypeLabel, refTypeTone } from './constants'

export const SearchIndexListItem = defineComponent({
  name: 'SearchIndexListItem',
  props: {
    row: { type: Object as PropType<SearchDocumentAdminRow>, required: true },
    selected: { type: Boolean, default: false },
    onSelect: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    return () => {
      const { row } = props
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
              <NTag size="small" type={refTypeTone[row.refType] ?? 'default'}>
                {refTypeLabel[row.refType] ?? row.refType}
              </NTag>
              {row.lang && (
                <NTag size="small" type="default">
                  {row.lang}
                </NTag>
              )}
              {!row.isPublished && (
                <NTag size="small" type="warning">
                  未发布
                </NTag>
              )}
              {row.hasPassword && (
                <NTag size="small" type="default">
                  密码
                </NTag>
              )}
            </div>

            <h3 class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {row.title || <span class="text-neutral-400">(无标题)</span>}
            </h3>

            <div class="text-xs tabular-nums text-neutral-400">
              title {row.titleLength} · body {row.bodyLength}
            </div>
          </div>

          <div class="shrink-0 text-xs text-neutral-500">
            <RelativeTime time={new Date(row.modifiedAt)} />
          </div>
        </div>
      )
    }
  },
})
