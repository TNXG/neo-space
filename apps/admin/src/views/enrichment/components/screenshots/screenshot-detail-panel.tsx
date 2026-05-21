import {
  ArrowLeft as ArrowLeftIcon,
  Camera as CameraIcon,
  ExternalLink as ExternalLinkIcon,
  Trash2 as TrashIcon,
} from 'lucide-vue-next'
import { NButton, NPopconfirm, NScrollbar, NTag, NTooltip } from 'naive-ui'
import { computed, defineComponent } from 'vue'
import { toast } from 'vue-sonner'
import type {
  EnrichmentScreenshotJoinedRow,
  EnrichmentScreenshotQuota,
} from '~/models/enrichment'
import type { PropType } from 'vue'

import { useMutation, useQueryClient } from '@tanstack/vue-query'

import { enrichmentApi } from '~/api/enrichment'
import { RelativeTime } from '~/components/time/relative-time'
import { queryKeys } from '~/hooks/queries/keys'

import { formatBytes } from '../../utils'

export const ScreenshotDetailPanel = defineComponent({
  name: 'ScreenshotDetailPanel',
  props: {
    row: {
      type: Object as PropType<EnrichmentScreenshotJoinedRow>,
      required: true,
    },
    quota: {
      type: Object as PropType<EnrichmentScreenshotQuota | null>,
      default: null,
    },
    isMobile: { type: Boolean, default: false },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onDeleted: {
      type: Function as PropType<(enrichmentId: string) => void>,
    },
  },
  setup(props) {
    const queryClient = useQueryClient()

    const invalidateAll = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.screenshots.all(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.screenshots.quota(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.byId(props.row.enrichmentId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.lists(),
      })
    }

    const deleteMutation = useMutation({
      mutationFn: () =>
        enrichmentApi.screenshots.delete(props.row.enrichmentId),
      onSuccess: () => {
        toast.success('已删除截图')
        invalidateAll()
        props.onDeleted?.(props.row.enrichmentId)
      },
    })

    const recaptureMutation = useMutation({
      mutationFn: () =>
        enrichmentApi.screenshots.recapture(props.row.enrichmentId),
      onSuccess: () => {
        toast.success('已重新截图')
        invalidateAll()
      },
    })

    const recaptureDisabledReason = computed<string | null>(() => {
      const q = props.quota
      if (!q) return '配额信息加载中'
      if (!q.enabled) return '截图功能未启用'
      if (q.fetchMode !== 'browser') return '当前抓取模式不支持重新截图'
      return null
    })

    return () => {
      const { row } = props
      const swatches = row.palette?.swatches ?? []
      const dominant = row.palette?.dominant
      const reason = recaptureDisabledReason.value

      const recaptureBtn = (
        <NButton
          size="small"
          secondary
          loading={recaptureMutation.isPending.value}
          disabled={reason !== null}
          onClick={() => recaptureMutation.mutate()}
        >
          {{
            icon: () => <CameraIcon class="size-4" />,
            default: () => '重新截图',
          }}
        </NButton>
      )

      return (
        <div class="flex h-full flex-col">
          <div class="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
            <div class="flex min-w-0 items-center gap-3">
              {props.isMobile && props.onBack && (
                <button
                  onClick={props.onBack}
                  class="-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                  <ArrowLeftIcon class="h-5 w-5" />
                </button>
              )}
              <NTag size="small" type="info">
                {row.provider}
              </NTag>
              <h2 class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {row.title || row.url}
              </h2>
            </div>

            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              title="打开原始链接"
            >
              <ExternalLinkIcon class="h-4 w-4" />
            </a>
          </div>

          <NScrollbar class="min-h-0 flex-1">
            <div class="mx-auto max-w-3xl space-y-6 p-6">
              <div
                class="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
                style={dominant ? { backgroundColor: dominant } : undefined}
              >
                <a
                  href={row.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block"
                >
                  <img
                    src={row.publicUrl}
                    alt={row.title || row.url}
                    loading="lazy"
                    class="w-full object-cover"
                  />
                </a>
              </div>

              <section class="space-y-3">
                <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  元信息
                </h3>
                <div class="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                  <table class="w-full text-xs">
                    <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                      <Row label="Provider">
                        <NTag size="small" type="info">
                          {row.provider}
                        </NTag>
                      </Row>
                      <Row label="External ID">
                        <code class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-neutral-800">
                          {row.externalId}
                        </code>
                      </Row>
                      <Row label="尺寸">
                        <span class="tabular-nums">
                          {row.width}×{row.height}
                        </span>
                      </Row>
                      <Row label="大小">
                        <span class="tabular-nums">
                          {formatBytes(row.bytes)}
                        </span>
                      </Row>
                      <Row label="创建于">
                        <RelativeTime time={new Date(row.createdAt)} />
                      </Row>
                      <Row label="最近访问">
                        <RelativeTime time={new Date(row.lastAccessedAt)} />
                      </Row>
                      <Row label="对象键">
                        <code class="break-all rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-neutral-800">
                          {row.objectKey}
                        </code>
                      </Row>
                    </tbody>
                  </table>
                </div>
              </section>

              {swatches.length > 0 && (
                <section class="space-y-2">
                  <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    调色板
                  </h3>
                  <div class="flex items-center gap-1.5">
                    {swatches.slice(0, 5).map((c) => (
                      <NTooltip key={c}>
                        {{
                          trigger: () => (
                            <span
                              class="block size-7 rounded border border-neutral-200 dark:border-neutral-800"
                              style={{ backgroundColor: c }}
                            />
                          ),
                          default: () => c,
                        }}
                      </NTooltip>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </NScrollbar>

          <div class="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
            {reason ? (
              <NTooltip>
                {{
                  trigger: () => (
                    <span class="inline-block">{recaptureBtn}</span>
                  ),
                  default: () => reason,
                }}
              </NTooltip>
            ) : (
              recaptureBtn
            )}
            <NPopconfirm
              positiveText="保留"
              negativeText="删除"
              onNegativeClick={() => deleteMutation.mutate()}
            >
              {{
                trigger: () => (
                  <NButton
                    size="small"
                    type="error"
                    tertiary
                    loading={deleteMutation.isPending.value}
                  >
                    {{
                      icon: () => <TrashIcon class="size-4" />,
                      default: () => '删除截图',
                    }}
                  </NButton>
                ),
                default: () => '删除此截图，但保留缓存条目？',
              }}
            </NPopconfirm>
          </div>
        </div>
      )
    }
  },
})

const Row = defineComponent({
  name: 'ScreenshotMetaRow',
  props: { label: { type: String, required: true } },
  setup(props, { slots }) {
    return () => (
      <tr>
        <td class="w-32 bg-neutral-50 px-3 py-1.5 font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          {props.label}
        </td>
        <td class="px-3 py-1.5 text-neutral-700 dark:text-neutral-300">
          {slots.default?.()}
        </td>
      </tr>
    )
  },
})
