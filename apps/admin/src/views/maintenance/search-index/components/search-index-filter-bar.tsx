import { Search as SearchIcon } from 'lucide-vue-next'
import { NButton, NInput, NSelect } from 'naive-ui'
import { defineComponent } from 'vue'
import type { SearchIndexRefType } from '~/models/search-index'
import type { PropType } from 'vue'

import { refTypeOptions } from './constants'

export const SearchIndexFilterBar = defineComponent({
  name: 'SearchIndexFilterBar',
  props: {
    refType: { type: String as PropType<SearchIndexRefType | undefined> },
    lang: { type: String, required: true },
    keyword: { type: String, required: true },
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
  },
  setup(props) {
    return () => (
      <div class="flex flex-col gap-2">
        <NInput
          size="small"
          placeholder="标题 / 正文关键词"
          value={props.keyword}
          onUpdateValue={(v) => props.onKeywordInput(v)}
          onKeyup={(e: KeyboardEvent) => {
            if (e.key === 'Enter') props.onKeywordCommit()
          }}
          clearable
        >
          {{
            prefix: () => (
              <SearchIcon
                class="size-3.5 text-neutral-400"
                aria-hidden="true"
              />
            ),
          }}
        </NInput>
        <div class="flex items-center gap-2">
          <NSelect
            size="small"
            class="flex-1"
            value={props.refType}
            options={refTypeOptions}
            onUpdateValue={(v) => props.onRefTypeChange(v as any)}
          />
          <NInput
            size="small"
            class="flex-1"
            placeholder="lang (zh/en)"
            value={props.lang}
            onUpdateValue={(v) => props.onLangChange(v)}
            clearable
          />
        </div>
        <div class="flex items-center justify-end gap-1">
          <NButton size="tiny" quaternary onClick={() => props.onReset()}>
            重置
          </NButton>
          <NButton
            size="tiny"
            secondary
            onClick={() => props.onKeywordCommit()}
          >
            应用
          </NButton>
        </div>
      </div>
    )
  },
})
