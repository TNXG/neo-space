import {
  AlertCircle as AlertIcon,
  CheckCircle2 as CheckIcon,
  Search as SearchIcon,
} from 'lucide-vue-next'
import { NScrollbar } from 'naive-ui'
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { ProbeHistoryEntry } from './types'

import { RelativeTime } from '~/components/time/relative-time'

export const ProbeList = defineComponent({
  name: 'ProbeList',
  props: {
    history: {
      type: Array as PropType<ProbeHistoryEntry[]>,
      required: true,
    },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    onSelect: {
      type: Function as PropType<(entry: ProbeHistoryEntry) => void>,
      required: true,
    },
    onNew: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <span class="text-xs text-neutral-500 dark:text-neutral-400">
            最近试抓 {props.history.length}/20
          </span>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            onClick={props.onNew}
          >
            <SearchIcon class="size-3" />
            新试抓
          </button>
        </div>

        <div class="min-h-0 flex-1">
          {props.history.length === 0 ? (
            <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
              <SearchIcon class="mb-3 size-10 text-neutral-300 dark:text-neutral-600" />
              <p class="text-sm text-neutral-500">暂无试抓记录</p>
              <p class="mt-1 text-xs text-neutral-400">右侧输入 URL 即可开始</p>
            </div>
          ) : (
            <NScrollbar class="h-full">
              <div>
                {props.history.map((entry) => (
                  <ProbeHistoryItem
                    key={entry.id}
                    entry={entry}
                    selected={props.selectedId === entry.id}
                    onSelect={() => props.onSelect(entry)}
                  />
                ))}
              </div>
            </NScrollbar>
          )}
        </div>
      </div>
    )
  },
})

const ProbeHistoryItem = defineComponent({
  name: 'ProbeHistoryItem',
  props: {
    entry: {
      type: Object as PropType<ProbeHistoryEntry>,
      required: true,
    },
    selected: { type: Boolean, default: false },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const { entry } = props
      const ok = !entry.result.error && !!entry.result.matched
      return (
        <div
          class={[
            'flex cursor-pointer flex-col gap-1 border-b border-neutral-100 px-4 py-2.5 transition-colors last:border-b-0 dark:border-neutral-800/50',
            props.selected
              ? 'bg-neutral-100 dark:bg-neutral-800'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30',
          ]}
          onClick={props.onSelect}
        >
          <div class="flex items-center gap-1.5 text-xs">
            {ok ? (
              <span class="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <CheckIcon class="size-3" />
                成功
              </span>
            ) : (
              <span class="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <AlertIcon class="size-3" />
                {entry.result.error ? '失败' : '未匹配'}
              </span>
            )}
            <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {entry.result.cached ? 'cached' : 'fresh'}
            </span>
          </div>
          <code class="truncate font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
            {entry.url}
          </code>
          <span class="text-[11px] text-neutral-400">
            <RelativeTime time={entry.at} />
          </span>
        </div>
      )
    }
  },
})
