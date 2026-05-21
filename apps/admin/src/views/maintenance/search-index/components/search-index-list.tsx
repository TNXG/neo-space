import { Loader2 as LoaderIcon } from 'lucide-vue-next'
import { NScrollbar } from 'naive-ui'
import { defineComponent } from 'vue'
import type {
  SearchDocumentAdminRow,
  SearchIndexRefType,
} from '~/models/search-index'
import type { PropType } from 'vue'

import { CompactPagination } from '~/components/pagination/compact-pagination'

import { SearchIndexEmptyState } from './search-index-empty-state'
import { SearchIndexFilterBar } from './search-index-filter-bar'
import { SearchIndexListItem } from './search-index-list-item'

export const SearchIndexList = defineComponent({
  name: 'SearchIndexList',
  props: {
    rows: {
      type: Array as PropType<SearchDocumentAdminRow[]>,
      required: true,
    },
    loading: { type: Boolean, default: false },
    selectedId: { type: String as PropType<string | null>, default: null },

    refType: { type: String as PropType<SearchIndexRefType | undefined> },
    lang: { type: String, required: true },
    keyword: { type: String, required: true },

    page: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    pageSize: { type: Number, required: true },

    onSelect: {
      type: Function as PropType<(row: SearchDocumentAdminRow) => void>,
      required: true,
    },
    onRefTypeChange: {
      type: Function as PropType<(v: SearchIndexRefType | undefined) => void>,
      required: true,
    },
    onLangChange: {
      type: Function as PropType<(v: string) => void>,
      required: true,
    },
    onKeywordInput: {
      type: Function as PropType<(v: string) => void>,
      required: true,
    },
    onKeywordCommit: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onReset: { type: Function as PropType<() => void>, required: true },
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
    return () => (
      <div class="flex h-full flex-col">
        <div class="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <SearchIndexFilterBar
            refType={props.refType}
            lang={props.lang}
            keyword={props.keyword}
            onRefTypeChange={props.onRefTypeChange}
            onLangChange={props.onLangChange}
            onKeywordInput={props.onKeywordInput}
            onKeywordCommit={props.onKeywordCommit}
            onReset={props.onReset}
          />
        </div>

        <div class="min-h-0 flex-1">
          {props.loading && props.rows.length === 0 ? (
            <div class="flex items-center justify-center py-16">
              <LoaderIcon class="size-5 animate-spin text-neutral-400" />
            </div>
          ) : props.rows.length === 0 ? (
            <SearchIndexEmptyState />
          ) : (
            <NScrollbar class="h-full">
              <div>
                {props.rows.map((row) => (
                  <SearchIndexListItem
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
