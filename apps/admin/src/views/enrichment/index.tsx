import {
  Eraser as EraserIcon,
  Loader2 as LoaderIcon,
  RefreshCw as RefreshIcon,
  DatabaseZap as SelectIcon,
} from 'lucide-vue-next'
import { computed, defineComponent, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  EnrichmentRow,
  EnrichmentScreenshotJoinedRow,
  EnrichmentScreenshotListResponse,
} from '~/models/enrichment'
import type { PropType } from 'vue'
import type { CacheFilterMode } from './components/cache/cache-list'
import type { ProbeHistoryEntry } from './components/probe/types'
import type {
  ScreenshotOrder,
  ScreenshotSort,
} from './components/screenshots/screenshot-list'
import type { EnrichmentSource } from './components/source-switcher'

import { useQuery, useQueryClient } from '@tanstack/vue-query'

import { enrichmentApi } from '~/api/enrichment'
import { HeaderActionButton } from '~/components/button/header-action-button'
import { MasterDetailLayout, useMasterDetailLayout } from '~/components/layout'
import { queryKeys } from '~/hooks/queries/keys'
import { useLayout } from '~/layouts/content'
import { RouteName } from '~/router/name'

import { CacheDetailPanel } from './components/cache/cache-detail-panel'
import { CacheList } from './components/cache/cache-list'
import { ProbeConsole } from './components/probe/probe-console'
import { ProbeList } from './components/probe/probe-list'
import { ProvidersStatusBar } from './components/providers-status-bar'
import { ScreenshotDetailPanel } from './components/screenshots/screenshot-detail-panel'
import { ScreenshotList } from './components/screenshots/screenshot-list'
import { ScreenshotQuotaChip } from './components/screenshots/screenshot-quota-chip'
import { SourceSwitcher } from './components/source-switcher'

const isEnrichmentSource = (v: unknown): v is EnrichmentSource =>
  v === 'cache' || v === 'screenshots' || v === 'probe'

const PROBE_HISTORY_MAX = 20

export default defineComponent({
  name: 'EnrichmentPage',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const queryClient = useQueryClient()
    const { setActions } = useLayout()
    const { isMobile } = useMasterDetailLayout()

    const initialSource = isEnrichmentSource(route.query.source)
      ? route.query.source
      : 'cache'
    const source = ref<EnrichmentSource>(initialSource)
    const selectedId = ref<string | null>((route.query.id as string) || null)
    const probeSelectedId = ref<string | null>(null)
    const showDetailOnMobile = ref(false)

    const cachePage = ref(1)
    const cacheSize = ref(20)
    const filterMode = ref<CacheFilterMode>('all')

    const screenshotPage = ref(1)
    const screenshotSize = ref(20)
    const screenshotSort = ref<ScreenshotSort>('last_accessed')
    const screenshotOrder = ref<ScreenshotOrder>('desc')

    const probeHistory = ref<ProbeHistoryEntry[]>([])

    const cacheListEnabled = computed(() => source.value === 'cache')
    const cacheParams = computed(() => ({
      page: cachePage.value,
      size: cacheSize.value,
      onlyFailed: filterMode.value === 'failed',
    }))

    const {
      data: cacheData,
      isPending: cachePending,
      isFetching: cacheFetching,
      refetch: refetchCache,
    } = useQuery({
      queryKey: computed(() => queryKeys.enrichment.list(cacheParams.value)),
      queryFn: () =>
        enrichmentApi.list({
          page: cachePage.value,
          size: cacheSize.value,
          onlyFailed: filterMode.value === 'failed' ? true : undefined,
        }),
      placeholderData: (prev) => prev,
      enabled: cacheListEnabled,
    })

    const cacheRows = computed<EnrichmentRow[]>(
      () => cacheData.value?.data || [],
    )
    const cacheTotal = computed(() => cacheData.value?.pagination.total || 0)
    const cachePageCount = computed(
      () => cacheData.value?.pagination.totalPage || 1,
    )

    const screenshotsEnabled = computed(() => source.value === 'screenshots')

    const { data: quotaData, refetch: refetchQuota } = useQuery({
      queryKey: queryKeys.enrichment.screenshots.quota(),
      queryFn: () => enrichmentApi.screenshots.quota(),
      enabled: screenshotsEnabled,
      staleTime: 30_000,
    })

    const cacheFallback = computed<EnrichmentRow | null>(() => {
      if (source.value !== 'cache' || !selectedId.value) return null
      return cacheRows.value.find((r) => r.id === selectedId.value) ?? null
    })

    const selectedScreenshot = computed<EnrichmentScreenshotJoinedRow | null>(
      () => {
        if (source.value !== 'screenshots' || !selectedId.value) return null
        const queries =
          queryClient.getQueriesData<EnrichmentScreenshotListResponse>({
            queryKey: queryKeys.enrichment.screenshots.all(),
          })
        for (const [, cached] of queries) {
          const hit = cached?.data?.find(
            (r) => r.enrichmentId === selectedId.value,
          )
          if (hit) return hit
        }
        return null
      },
    )

    const selectedProbe = computed<ProbeHistoryEntry | null>(() => {
      if (source.value !== 'probe' || !probeSelectedId.value) return null
      return (
        probeHistory.value.find((e) => e.id === probeSelectedId.value) ?? null
      )
    })

    const handleCacheSelect = (row: EnrichmentRow) => {
      selectedId.value = row.id
      if (isMobile.value) showDetailOnMobile.value = true
    }

    const handleScreenshotSelect = (row: EnrichmentScreenshotJoinedRow) => {
      selectedId.value = row.enrichmentId
      if (isMobile.value) showDetailOnMobile.value = true
    }

    const handleBack = () => {
      showDetailOnMobile.value = false
    }

    const handleSourceChange = (next: EnrichmentSource) => {
      if (source.value === next) return
      source.value = next
      selectedId.value = null
      if (next !== 'probe') probeSelectedId.value = null
      showDetailOnMobile.value = false
    }

    const handleFilterChange = (next: CacheFilterMode) => {
      filterMode.value = next
      cachePage.value = 1
    }

    const handleJumpToScreenshot = (enrichmentId: string) => {
      source.value = 'screenshots'
      selectedId.value = enrichmentId
      if (isMobile.value) showDetailOnMobile.value = true
    }

    const handleScreenshotDeleted = (enrichmentId: string) => {
      if (selectedId.value === enrichmentId) {
        selectedId.value = null
        showDetailOnMobile.value = false
      }
    }

    const pushProbeEntry = (entry: ProbeHistoryEntry) => {
      probeHistory.value.unshift(entry)
      if (probeHistory.value.length > PROBE_HISTORY_MAX) {
        probeHistory.value.splice(PROBE_HISTORY_MAX)
      }
      probeSelectedId.value = entry.id
      if (isMobile.value) showDetailOnMobile.value = true
    }

    const handleProbeSelect = (entry: ProbeHistoryEntry) => {
      probeSelectedId.value = entry.id
      if (isMobile.value) showDetailOnMobile.value = true
    }

    const handleProbeNew = () => {
      probeSelectedId.value = null
    }

    const handleClearProbe = () => {
      probeHistory.value = []
      probeSelectedId.value = null
    }

    watch(
      [source, selectedId],
      ([s, id]) => {
        const query: Record<string, string> = {}
        if (s !== 'cache') query.source = s
        if (id && s !== 'probe') query.id = id
        router.replace({
          name: RouteName.Enrichment,
          query,
        })
      },
      { flush: 'post' },
    )

    watch(
      () => selectedId.value,
      (id) => {
        if (id && isMobile.value) showDetailOnMobile.value = true
        if (!id && source.value !== 'probe') showDetailOnMobile.value = false
      },
    )

    watch(probeSelectedId, (id) => {
      if (source.value !== 'probe') return
      if (id && isMobile.value) showDetailOnMobile.value = true
    })

    watchEffect(() => {
      if (source.value === 'cache') {
        setActions(
          <div class="flex items-center gap-2">
            <span class="hidden text-xs tabular-nums text-neutral-500 md:inline">
              共 {cacheTotal.value} 条
            </span>
            <HeaderActionButton
              icon={
                cacheFetching.value ? (
                  <LoaderIcon class="animate-spin" />
                ) : (
                  <RefreshIcon />
                )
              }
              name="刷新"
              onClick={() => refetchCache()}
            />
          </div>,
        )
      } else if (source.value === 'screenshots') {
        setActions(
          <div class="flex items-center gap-2">
            <span class="hidden md:inline">
              <ScreenshotQuotaChip quota={quotaData.value ?? null} />
            </span>
            <HeaderActionButton
              icon={<RefreshIcon />}
              name="刷新"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: queryKeys.enrichment.screenshots.all(),
                })
                refetchQuota()
              }}
            />
          </div>,
        )
      } else {
        setActions(
          <HeaderActionButton
            icon={<EraserIcon />}
            name="清空历史"
            onClick={handleClearProbe}
            disabled={probeHistory.value.length === 0}
          />,
        )
      }
    })

    const masterDetailSize = computed(() =>
      source.value === 'probe'
        ? { defaultSize: 0.25, min: 0.2, max: 0.35 }
        : { defaultSize: 0.35, min: 0.25, max: 0.5 },
    )

    return () => (
      <MasterDetailLayout
        showDetailOnMobile={showDetailOnMobile.value}
        defaultSize={masterDetailSize.value.defaultSize}
        min={masterDetailSize.value.min}
        max={masterDetailSize.value.max}
      >
        {{
          list: () => (
            <div class="flex h-full flex-col">
              <div class="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <SourceSwitcher
                  value={source.value}
                  onChange={handleSourceChange}
                />
                {source.value === 'cache' && (
                  <>
                    <ProvidersStatusBar />
                    <FilterSegment
                      value={filterMode.value}
                      onChange={handleFilterChange}
                    />
                  </>
                )}
              </div>

              <div class="min-h-0 flex-1">
                {source.value === 'cache' && (
                  <CacheList
                    rows={cacheRows.value}
                    loading={cachePending.value}
                    selectedId={selectedId.value}
                    filterMode={filterMode.value}
                    page={cachePage.value}
                    pageCount={cachePageCount.value}
                    pageSize={cacheSize.value}
                    onSelect={handleCacheSelect}
                    onPageChange={(p) => (cachePage.value = p)}
                    onPageSizeChange={(s) => {
                      cacheSize.value = s
                      cachePage.value = 1
                    }}
                  />
                )}
                {source.value === 'screenshots' && (
                  <ScreenshotList
                    page={screenshotPage.value}
                    pageSize={screenshotSize.value}
                    sort={screenshotSort.value}
                    order={screenshotOrder.value}
                    selectedId={selectedId.value}
                    quota={quotaData.value ?? null}
                    onSelect={handleScreenshotSelect}
                    onPageChange={(p) => (screenshotPage.value = p)}
                    onPageSizeChange={(s) => {
                      screenshotSize.value = s
                      screenshotPage.value = 1
                    }}
                    onSortChange={(v) => {
                      screenshotSort.value = v
                      screenshotPage.value = 1
                    }}
                    onOrderChange={(v) => {
                      screenshotOrder.value = v
                      screenshotPage.value = 1
                    }}
                  />
                )}
                {source.value === 'probe' && (
                  <ProbeList
                    history={probeHistory.value}
                    selectedId={probeSelectedId.value}
                    onSelect={handleProbeSelect}
                    onNew={handleProbeNew}
                  />
                )}
              </div>
            </div>
          ),
          detail: () => {
            if (source.value === 'cache' && selectedId.value) {
              return (
                <CacheDetailPanel
                  id={selectedId.value}
                  fallback={cacheFallback.value}
                  isMobile={isMobile.value}
                  onBack={handleBack}
                  onJumpToScreenshot={handleJumpToScreenshot}
                />
              )
            }
            if (source.value === 'screenshots' && selectedScreenshot.value) {
              return (
                <ScreenshotDetailPanel
                  row={selectedScreenshot.value}
                  quota={quotaData.value ?? null}
                  isMobile={isMobile.value}
                  onBack={handleBack}
                  onDeleted={handleScreenshotDeleted}
                />
              )
            }
            if (source.value === 'probe') {
              return (
                <ProbeConsole
                  selectedEntry={selectedProbe.value}
                  isMobile={isMobile.value}
                  onBack={handleBack}
                  onProbed={pushProbeEntry}
                  onNew={handleProbeNew}
                />
              )
            }
            return null
          },
          empty: () => <DetailEmptyState />,
        }}
      </MasterDetailLayout>
    )
  },
})

const FilterSegment = defineComponent({
  name: 'CacheFilterSegment',
  props: {
    value: {
      type: String as PropType<CacheFilterMode>,
      required: true,
    },
    onChange: {
      type: Function as PropType<(v: CacheFilterMode) => void>,
      required: true,
    },
  },
  setup(props) {
    const items: Array<{ key: CacheFilterMode; label: string }> = [
      { key: 'all', label: '全部' },
      { key: 'failed', label: '仅失败' },
    ]
    return () => (
      <div class="inline-flex items-center gap-0.5 self-start rounded-md border border-neutral-200 p-0.5 dark:border-neutral-800">
        {items.map((it) => {
          const active = props.value === it.key
          return (
            <button
              key={it.key}
              type="button"
              class={[
                'rounded px-2.5 py-1 text-xs transition-colors',
                active
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
              ]}
              onClick={() => props.onChange(it.key)}
            >
              {it.label}
            </button>
          )
        })}
      </div>
    )
  },
})

const DetailEmptyState = defineComponent({
  name: 'EnrichmentDetailEmptyState',
  setup() {
    return () => (
      <div class="flex h-full flex-col items-center justify-center bg-neutral-50 text-center dark:bg-neutral-950">
        <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <SelectIcon class="size-8 text-neutral-400" />
        </div>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          请从左侧选择
        </p>
      </div>
    )
  },
})
