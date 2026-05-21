import {
  ArrowLeft as ArrowLeftIcon,
  Search as SearchIcon,
} from 'lucide-vue-next'
import { NButton, NCheckbox, NInput, NScrollbar } from 'naive-ui'
import { computed, defineComponent, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { PropType } from 'vue'
import type { ProbeHistoryEntry } from './types'

import { useMutation } from '@tanstack/vue-query'

import { enrichmentApi } from '~/api/enrichment'

import { ProbeResultView } from './probe-result-view'

const generateId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export const ProbeConsole = defineComponent({
  name: 'ProbeConsole',
  props: {
    selectedEntry: {
      type: Object as PropType<ProbeHistoryEntry | null>,
      default: null,
    },
    isMobile: { type: Boolean, default: false },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onProbed: {
      type: Function as PropType<(entry: ProbeHistoryEntry) => void>,
      required: true,
    },
    onNew: {
      type: Function as PropType<() => void>,
    },
  },
  setup(props) {
    const urlInput = ref('')
    const useCache = ref(false)

    const probeMutation = useMutation({
      mutationFn: (input: { url: string; useCache: boolean }) =>
        enrichmentApi.probe(input.url, input.useCache),
      onSuccess: (data, vars) => {
        const entry: ProbeHistoryEntry = {
          id: generateId(),
          url: vars.url,
          useCache: vars.useCache,
          result: data,
          at: new Date(),
        }
        props.onProbed(entry)
        if (data.error) {
          toast.warning(`已记录：${data.error.code}`)
        } else if (!data.matched) {
          toast.info('已抓取，但无匹配 provider')
        } else {
          toast.success('已抓取')
        }
      },
    })

    const canSubmit = computed(
      () => urlInput.value.trim().length > 0 && !probeMutation.isPending.value,
    )

    const handleSubmit = () => {
      const url = urlInput.value.trim()
      if (!url) return
      probeMutation.mutate({ url, useCache: useCache.value })
    }

    const handleNewProbe = () => {
      urlInput.value = ''
      props.onNew?.()
    }

    return () => {
      const entry = props.selectedEntry
      const headerTitle = entry ? '试抓详情' : 'URL 试抓'

      return (
        <div class="flex h-full flex-col">
          <div class="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
            <div class="flex items-center gap-3">
              {props.isMobile && props.onBack && (
                <button
                  onClick={props.onBack}
                  class="-ml-2 flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                  <ArrowLeftIcon class="h-5 w-5" />
                </button>
              )}
              <h2 class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {headerTitle}
              </h2>
            </div>
            {entry && (
              <NButton size="small" secondary onClick={handleNewProbe}>
                {{
                  icon: () => <SearchIcon class="size-3" />,
                  default: () => '新试抓',
                }}
              </NButton>
            )}
          </div>

          <NScrollbar class="min-h-0 flex-1">
            <div class="mx-auto max-w-3xl space-y-6 p-6">
              <section class="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <NInput
                  value={urlInput.value}
                  onUpdateValue={(v) => (urlInput.value = v)}
                  placeholder="输入要试抓的 URL，例如 https://github.com/innei/mx-core"
                  onKeyup={(e) => {
                    if (e.key === 'Enter' && canSubmit.value) handleSubmit()
                  }}
                />
                <div class="flex items-center justify-between">
                  <NCheckbox
                    checked={useCache.value}
                    onUpdateChecked={(v) => (useCache.value = v)}
                  >
                    <span class="text-xs">如已有缓存则使用缓存</span>
                  </NCheckbox>
                  <NButton
                    type="primary"
                    size="small"
                    loading={probeMutation.isPending.value}
                    disabled={!canSubmit.value}
                    onClick={handleSubmit}
                  >
                    {{
                      icon: () => <SearchIcon class="size-4" />,
                      default: () => '试抓',
                    }}
                  </NButton>
                </div>
              </section>

              {entry && (
                <ProbeResultView url={entry.url} probe={entry.result} />
              )}
            </div>
          </NScrollbar>
        </div>
      )
    }
  },
})
