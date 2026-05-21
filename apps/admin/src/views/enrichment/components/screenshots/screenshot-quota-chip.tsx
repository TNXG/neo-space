import { NTooltip } from 'naive-ui'
import { computed, defineComponent } from 'vue'
import type { EnrichmentScreenshotQuota } from '~/models/enrichment'
import type { PropType } from 'vue'

import { formatBytes } from '../../utils'

export const ScreenshotQuotaChip = defineComponent({
  name: 'ScreenshotQuotaChip',
  props: {
    quota: {
      type: Object as PropType<EnrichmentScreenshotQuota | null>,
      default: null,
    },
  },
  setup(props) {
    const computedState = computed(() => {
      const q = props.quota
      if (!q) return null
      const countRatio = q.cap.maxItems > 0 ? q.used.count / q.cap.maxItems : 0
      const bytesRatio =
        q.cap.maxTotalBytes > 0 ? q.used.totalBytes / q.cap.maxTotalBytes : 0
      const peak = Math.max(countRatio, bytesRatio)
      const tone =
        peak >= 0.9
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
          : peak >= 0.8
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400'
            : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
      return { q, tone }
    })

    return () => {
      const s = computedState.value
      if (!s) {
        return (
          <span class="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
            配额加载中…
          </span>
        )
      }
      const { q, tone } = s
      const countLabel = `${q.used.count}/${q.cap.maxItems}`
      const bytesLabel = `${formatBytes(q.used.totalBytes)} / ${formatBytes(q.cap.maxTotalBytes)}`
      const tooltipLines = [
        `数量：${q.used.count} / ${q.cap.maxItems}`,
        `占用：${formatBytes(q.used.totalBytes)} / ${formatBytes(q.cap.maxTotalBytes)}`,
        `状态：${q.enabled ? '启用' : '关闭'}`,
        `抓取模式：${q.fetchMode}`,
      ]
      return (
        <NTooltip placement="bottom">
          {{
            trigger: () => (
              <span
                class={[
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] tabular-nums',
                  tone,
                ]}
              >
                <span class="font-medium">{countLabel}</span>
                <span class="text-neutral-400">·</span>
                <span>{bytesLabel}</span>
              </span>
            ),
            default: () => (
              <div class="space-y-0.5 text-xs">
                {tooltipLines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            ),
          }}
        </NTooltip>
      )
    }
  },
})
