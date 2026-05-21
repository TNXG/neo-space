import { Loader2 as LoaderIcon } from 'lucide-vue-next'
import { NScrollbar } from 'naive-ui'
import { defineComponent } from 'vue'
import type { EnrichmentRow } from '~/models/enrichment'
import type { PropType } from 'vue'

import { CompactPagination } from '~/components/pagination/compact-pagination'

import { CacheEmptyState } from './cache-empty-state'
import { CacheListItem } from './cache-list-item'

export type CacheFilterMode = 'all' | 'failed'

export const CacheList = defineComponent({
  name: 'CacheList',
  props: {
    rows: {
      type: Array as PropType<EnrichmentRow[]>,
      required: true,
    },
    loading: { type: Boolean, default: false },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    filterMode: {
      type: String as PropType<CacheFilterMode>,
      required: true,
    },
    page: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    pageSize: { type: Number, required: true },
    onSelect: {
      type: Function as PropType<(row: EnrichmentRow) => void>,
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
  },
  setup(props) {
    return () => (
      <div class="flex h-full min-h-0 flex-col">
        <div class="min-h-0 flex-1">
          {props.loading && props.rows.length === 0 ? (
            <div class="flex items-center justify-center py-16">
              <LoaderIcon class="size-5 animate-spin text-neutral-400" />
            </div>
          ) : props.rows.length === 0 ? (
            <CacheEmptyState filtered={props.filterMode === 'failed'} />
          ) : (
            <NScrollbar class="h-full">
              <div>
                {props.rows.map((row) => (
                  <CacheListItem
                    key={row.id}
                    row={row}
                    selected={props.selectedId === row.id}
                    onSelect={() => props.onSelect(row)}
                  />
                ))}
              </div>
            </NScrollbar>
          )}
        </div>

        {props.pageCount > 1 && (
          <div class="flex shrink-0 items-center justify-end border-t border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
            <CompactPagination
              page={props.page}
              pageCount={props.pageCount}
              pageSize={props.pageSize}
              onPageChange={(p) => props.onPageChange(p)}
              onPageSizeChange={(s) => props.onPageSizeChange(s)}
            />
          </div>
        )}
      </div>
    )
  },
})
