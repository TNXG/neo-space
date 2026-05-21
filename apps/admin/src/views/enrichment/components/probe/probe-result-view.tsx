import {
  AlertCircle as AlertIcon,
  CheckCircle2 as CheckIcon,
  Save as SaveIcon,
  Slash as SlashIcon,
} from 'lucide-vue-next'
import { NButton, NTag } from 'naive-ui'
import { computed, defineComponent } from 'vue'
import { toast } from 'vue-sonner'
import type { EnrichmentProbeResult } from '~/models/enrichment'
import type { PropType } from 'vue'

import { useMutation, useQueryClient } from '@tanstack/vue-query'

import { enrichmentApi } from '~/api/enrichment'
import { queryKeys } from '~/hooks/queries/keys'

import { CacheNormalizedSection } from '../cache/cache-normalized-section'
import { RawJsonBlock } from '../raw-json-block'

export const ProbeResultView = defineComponent({
  name: 'ProbeResultView',
  props: {
    url: { type: String, required: true },
    probe: {
      type: Object as PropType<EnrichmentProbeResult>,
      required: true,
    },
  },
  setup(props) {
    const queryClient = useQueryClient()

    const canPersist = computed(() => {
      const p = props.probe
      return !p.cached && !p.error && !!p.matched
    })

    const persistMutation = useMutation({
      mutationFn: () => {
        const m = props.probe.matched
        if (!m) throw new Error('未匹配 provider')
        return enrichmentApi.refresh(m.provider, m.externalId)
      },
      onSuccess: () => {
        toast.success('已持久化')
        queryClient.invalidateQueries({
          queryKey: queryKeys.enrichment.all,
        })
      },
    })

    return () => {
      const { probe } = props
      const matched = probe.matched
      const result = probe.result

      return (
        <div class="space-y-6">
          <div class="flex flex-wrap items-center gap-2">
            {matched ? (
              <NTag size="small" type="success">
                {{
                  icon: () => <CheckIcon class="size-3" />,
                  default: () => (
                    <span>
                      {matched.provider} ·{' '}
                      <code class="font-mono text-[11px]">
                        {matched.externalId}
                      </code>
                    </span>
                  ),
                }}
              </NTag>
            ) : (
              <NTag size="small" type="warning">
                {{
                  icon: () => <SlashIcon class="size-3" />,
                  default: () => '无匹配 provider',
                }}
              </NTag>
            )}
            <NTag size="small" type={probe.cached ? 'default' : 'info'}>
              {probe.cached ? '使用缓存' : '强制刷新'}
            </NTag>
          </div>

          {probe.error && (
            <div class="space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
              <div class="flex items-center gap-1 font-medium">
                <AlertIcon class="size-3.5" />
                <code class="font-mono">{probe.error.code}</code>
              </div>
              <div class="break-words">{probe.error.message}</div>
            </div>
          )}

          {result && (
            <CacheNormalizedSection result={result} title="抓取结果" />
          )}

          <RawJsonBlock
            value={result ?? probe}
            title="Raw payload"
            defaultExpanded={!result}
          />

          {canPersist.value && (
            <div class="flex justify-end">
              <NButton
                size="small"
                type="primary"
                loading={persistMutation.isPending.value}
                onClick={() => persistMutation.mutate()}
              >
                {{
                  icon: () => <SaveIcon class="size-4" />,
                  default: () => '持久化结果',
                }}
              </NButton>
            </div>
          )}
        </div>
      )
    }
  },
})
