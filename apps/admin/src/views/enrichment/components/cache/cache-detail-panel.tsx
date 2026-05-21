import {
  ArrowLeft as ArrowLeftIcon,
  ExternalLink as ExternalLinkIcon,
  Eye as EyeIcon,
  Image as ImageIcon,
  Loader2 as LoaderIcon,
  RefreshCw as RefreshIcon,
  Trash2 as TrashIcon,
} from 'lucide-vue-next'
import { NButton, NPopconfirm, NScrollbar, NTag } from 'naive-ui'
import { computed, defineComponent } from 'vue'
import { toast } from 'vue-sonner'
import type { EnrichmentRow, EnrichmentRowDetail } from '~/models/enrichment'
import type { PropType } from 'vue'

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { enrichmentApi } from '~/api/enrichment'
import { RelativeTime } from '~/components/time/relative-time'
import { queryKeys } from '~/hooks/queries/keys'
import { BusinessError } from '~/utils/request'

import { formatBytes } from '../../utils'
import { RawJsonBlock } from '../raw-json-block'
import { CacheEmptyState } from './cache-empty-state'
import { CacheNormalizedSection } from './cache-normalized-section'

export const CacheDetailPanel = defineComponent({
  name: 'CacheDetailPanel',
  props: {
    id: { type: String, required: true },
    fallback: {
      type: Object as PropType<EnrichmentRow | null>,
      default: null,
    },
    isMobile: { type: Boolean, default: false },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onJumpToScreenshot: {
      type: Function as PropType<(enrichmentId: string) => void>,
    },
  },
  setup(props) {
    const queryClient = useQueryClient()

    const { data, isPending, isError, error } = useQuery<EnrichmentRowDetail>({
      queryKey: computed(() => queryKeys.enrichment.byId(props.id)),
      queryFn: () => enrichmentApi.byId(props.id),
      retry: (count, err) => {
        if (err instanceof BusinessError && err.statusCode === 404) return false
        return count < 2
      },
      initialData: () => {
        if (props.fallback && props.fallback.id === props.id) {
          return {
            ...props.fallback,
            screenshot: null,
          } as EnrichmentRowDetail
        }
        return undefined
      },
    })

    const is404 = computed(
      () =>
        isError.value &&
        error.value instanceof BusinessError &&
        error.value.statusCode === 404,
    )

    const invalidateRow = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.byId(props.id),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.lists(),
      })
    }

    const refreshMutation = useMutation({
      mutationFn: () => {
        const row = data.value
        if (!row) throw new Error('数据未加载')
        return enrichmentApi.refresh(
          row.provider,
          row.externalId,
          row.locale || undefined,
        )
      },
      onSuccess: () => {
        toast.success('已刷新')
        invalidateRow()
        queryClient.invalidateQueries({
          queryKey: queryKeys.enrichment.screenshots.all(),
        })
      },
    })

    const invalidateMutation = useMutation({
      mutationFn: () => {
        const row = data.value
        if (!row) throw new Error('数据未加载')
        return enrichmentApi.invalidate(row.provider, row.externalId)
      },
      onSuccess: () => {
        toast.success('已失效')
        queryClient.invalidateQueries({
          queryKey: queryKeys.enrichment.all,
        })
      },
    })

    return () => {
      if (is404.value) {
        return (
          <div class="flex h-full flex-col">
            <DetailHeader
              isMobile={props.isMobile}
              onBack={props.onBack}
              title="缓存项已删除"
            />
            <div class="flex flex-1 items-center justify-center">
              <CacheEmptyState />
            </div>
          </div>
        )
      }

      const row = data.value

      if (!row) {
        return (
          <div class="flex h-full flex-col">
            <DetailHeader
              isMobile={props.isMobile}
              onBack={props.onBack}
              title="加载中"
            />
            <div class="flex flex-1 items-center justify-center">
              <LoaderIcon class="size-5 animate-spin text-neutral-400" />
            </div>
          </div>
        )
      }

      const subtitle = [row.normalized.category, row.normalized.subtype]
        .filter(Boolean)
        .join(' · ')
      const screenshotMeta = row.screenshot
      const normalizedShot = row.normalized.screenshot

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
                {row.normalized.title || row.url}
              </h2>
              {isPending.value && (
                <LoaderIcon class="size-3.5 animate-spin text-neutral-400" />
              )}
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
              <div class="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                {subtitle && <span>{subtitle}</span>}
                <span>
                  抓取于 <RelativeTime time={new Date(row.fetchedAt)} />
                </span>
                {row.expiresAt && (
                  <span>
                    过期 <RelativeTime time={new Date(row.expiresAt)} />
                  </span>
                )}
                {row.locale ? (
                  <NTag size="small" type="default">
                    {row.locale}
                  </NTag>
                ) : (
                  <span>默认 locale</span>
                )}
              </div>

              <CacheNormalizedSection result={row.normalized} />

              <div class="h-px bg-neutral-100 dark:bg-neutral-800" />

              <section>
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    截图
                  </h3>
                  {screenshotMeta && (
                    <NButton
                      size="tiny"
                      secondary
                      onClick={() => props.onJumpToScreenshot?.(row.id)}
                    >
                      {{
                        icon: () => <EyeIcon class="size-3" />,
                        default: () => '查看截图',
                      }}
                    </NButton>
                  )}
                </div>
                {screenshotMeta ? (
                  <div class="space-y-2">
                    {normalizedShot?.url && (
                      <a
                        href={normalizedShot.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block max-w-md overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
                      >
                        <img
                          src={normalizedShot.url}
                          alt="screenshot"
                          class="w-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    )}
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>
                        {screenshotMeta.width}×{screenshotMeta.height}
                      </span>
                      <span>{formatBytes(screenshotMeta.bytes)}</span>
                      <span>
                        创建于{' '}
                        <RelativeTime
                          time={new Date(screenshotMeta.createdAt)}
                        />
                      </span>
                      <span>
                        最近访问{' '}
                        <RelativeTime
                          time={new Date(screenshotMeta.lastAccessedAt)}
                        />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div class="flex items-center gap-2 rounded-md border border-dashed border-neutral-200 px-3 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    <ImageIcon class="size-4" aria-hidden="true" />
                    无截图
                  </div>
                )}
              </section>

              <div class="h-px bg-neutral-100 dark:bg-neutral-800" />

              <RawJsonBlock value={row.raw} />

              {row.failureCount > 0 && (
                <>
                  <div class="h-px bg-neutral-100 dark:bg-neutral-800" />
                  <section>
                    <h3 class="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
                      失败信息
                    </h3>
                    <div class="space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                      <div>失败次数：{row.failureCount}</div>
                      {row.lastError && (
                        <div class="break-words">{row.lastError}</div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </NScrollbar>

          <div class="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <NButton
              size="small"
              secondary
              loading={refreshMutation.isPending.value}
              onClick={() => refreshMutation.mutate()}
            >
              {{
                icon: () => <RefreshIcon class="size-4" />,
                default: () => '刷新',
              }}
            </NButton>
            <NPopconfirm
              positiveText="保留"
              negativeText="失效"
              onNegativeClick={() => invalidateMutation.mutate()}
            >
              {{
                trigger: () => (
                  <NButton
                    size="small"
                    type="error"
                    tertiary
                    loading={invalidateMutation.isPending.value}
                  >
                    {{
                      icon: () => <TrashIcon class="size-4" />,
                      default: () => '失效',
                    }}
                  </NButton>
                ),
                default: () => '将此缓存项失效？',
              }}
            </NPopconfirm>
          </div>
        </div>
      )
    }
  },
})

const DetailHeader = defineComponent({
  name: 'CacheDetailHeader',
  props: {
    isMobile: { type: Boolean, default: false },
    onBack: { type: Function as PropType<() => void> },
    title: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <div class="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
        {props.isMobile && props.onBack && (
          <button
            onClick={props.onBack}
            class="-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <ArrowLeftIcon class="h-5 w-5" />
          </button>
        )}
        <h2 class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {props.title}
        </h2>
      </div>
    )
  },
})
