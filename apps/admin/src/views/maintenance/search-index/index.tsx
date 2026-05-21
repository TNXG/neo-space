import {
  Hammer as ForceRebuildIcon,
  Layers as IncrementalRebuildIcon,
  Loader2 as LoaderIcon,
  RefreshCw as RefreshIcon,
} from 'lucide-vue-next'
import { NPopconfirm } from 'naive-ui'
import { computed, defineComponent, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import type {
  SearchDocumentAdminRow,
  SearchIndexRefType,
} from '~/models/search-index'

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { searchIndexApi } from '~/api/search-index'
import { HeaderActionButton } from '~/components/button/header-action-button'
import { MasterDetailLayout, useMasterDetailLayout } from '~/components/layout'
import { queryKeys } from '~/hooks/queries/keys'
import { useLayout } from '~/hooks/use-layout'
import { RouteName } from '~/router/name'

import { SearchIndexDetailPanel } from './components/search-index-detail-panel'
import { SearchIndexDetailEmptyState } from './components/search-index-empty-state'
import { SearchIndexList } from './components/search-index-list'

export default defineComponent({
  name: 'SearchIndexAdminPage',
  setup() {
    const queryClient = useQueryClient()
    const route = useRoute()
    const router = useRouter()
    const { isMobile } = useMasterDetailLayout()

    const refTypeFilter = ref<SearchIndexRefType | undefined>(undefined)
    const langFilter = ref<string>('')
    const keywordRaw = ref<string>('')
    const keywordCommitted = ref<string>('')
    const pageRef = ref(1)
    const sizeRef = ref(20)

    const selectedId = ref<string | null>((route.query.id as string) || null)
    const showDetailOnMobile = ref(!!selectedId.value)

    const queryParams = computed(() => ({
      refType: refTypeFilter.value,
      lang: langFilter.value || undefined,
      keyword: keywordCommitted.value || undefined,
      page: pageRef.value,
      size: sizeRef.value,
    }))

    const { data, isPending, isFetching, refetch } = useQuery({
      queryKey: computed(() => queryKeys.searchIndex.list(queryParams.value)),
      queryFn: () => searchIndexApi.listDocuments(queryParams.value),
      placeholderData: (prev) => prev,
    })

    const rows = computed<SearchDocumentAdminRow[]>(
      () => data.value?.data || [],
    )
    const total = computed(() => data.value?.pagination.total || 0)
    const pageCount = computed(() => data.value?.pagination.totalPage || 1)

    const selectedRow = computed<SearchDocumentAdminRow | null>(() => {
      const id = selectedId.value
      if (!id) return null
      return rows.value.find((r) => r.id === id) ?? null
    })

    const rebuildMutation = useMutation({
      mutationFn: ({ refType, refId }: { refType: string; refId: string }) =>
        searchIndexApi.rebuildOne(refType, refId),
      onSuccess: (result) => {
        toast.success(`已重建 ${result.rebuilt} 行`)
        queryClient.invalidateQueries({ queryKey: queryKeys.searchIndex.all })
      },
      onError: (e: any) => {
        toast.error(e?.message || '重建失败')
      },
    })

    const rebuildAllMutation = useMutation({
      mutationFn: (force: boolean) => searchIndexApi.rebuildAll(force),
      onSuccess: (r, force) => {
        toast.success(
          `${force ? '全量' : '增量'}重建完成 · total ${r.total} · +${r.created} ~${r.updated} -${r.deleted} =${r.skipped}`,
        )
        queryClient.invalidateQueries({ queryKey: queryKeys.searchIndex.all })
      },
      onError: (e: any) => {
        toast.error(e?.message || '重建失败')
      },
    })

    const commitKeyword = () => {
      keywordCommitted.value = keywordRaw.value.trim()
      pageRef.value = 1
    }

    const resetFilters = () => {
      refTypeFilter.value = undefined
      langFilter.value = ''
      keywordRaw.value = ''
      keywordCommitted.value = ''
      pageRef.value = 1
    }

    const handleSelect = (row: SearchDocumentAdminRow) => {
      selectedId.value = row.id
      if (isMobile.value) showDetailOnMobile.value = true
    }

    const handleBack = () => {
      showDetailOnMobile.value = false
    }

    const handleRebuildSelected = () => {
      const row = selectedRow.value
      if (!row) return
      rebuildMutation.mutate({ refType: row.refType, refId: row.refId })
    }

    const isSelectedRebuilding = computed(() => {
      const row = selectedRow.value
      if (!row) return false
      return (
        rebuildMutation.isPending.value &&
        rebuildMutation.variables.value?.refType === row.refType &&
        rebuildMutation.variables.value?.refId === row.refId
      )
    })

    watch(
      selectedId,
      (id) => {
        router.replace({
          name: RouteName.SearchIndex,
          query: id ? { id } : {},
        })
      },
      { flush: 'post' },
    )

    const { setActions } = useLayout()
    watchEffect(() => {
      const isRebuildingAll = rebuildAllMutation.isPending.value
      setActions(
        <div class="flex items-center gap-2">
          <span class="hidden text-xs tabular-nums text-neutral-500 md:inline">
            共 {total.value} 条
          </span>
          <NPopconfirm
            positiveText="增量重建"
            negativeText="取消"
            onPositiveClick={() => rebuildAllMutation.mutate(false)}
          >
            {{
              trigger: () => (
                <HeaderActionButton
                  icon={
                    isRebuildingAll &&
                    rebuildAllMutation.variables.value === false ? (
                      <LoaderIcon class="animate-spin" />
                    ) : (
                      <IncrementalRebuildIcon />
                    )
                  }
                  name="增量重建"
                  variant="info"
                  disabled={isRebuildingAll}
                />
              ),
              default: () => (
                <span>
                  按 sourceHash 比对，仅 upsert 变更行并清理孤立条目。
                </span>
              ),
            }}
          </NPopconfirm>
          <NPopconfirm
            positiveText="全量重建"
            negativeText="取消"
            onPositiveClick={() => rebuildAllMutation.mutate(true)}
          >
            {{
              trigger: () => (
                <HeaderActionButton
                  icon={
                    isRebuildingAll &&
                    rebuildAllMutation.variables.value === true ? (
                      <LoaderIcon class="animate-spin" />
                    ) : (
                      <ForceRebuildIcon />
                    )
                  }
                  name="全量重建"
                  variant="warning"
                  disabled={isRebuildingAll}
                />
              ),
              default: () => (
                <span class="text-amber-600 dark:text-amber-400">
                  将清空 search
                  表后重建全部文档，搜索功能将短暂不可用，确认继续？
                </span>
              ),
            }}
          </NPopconfirm>
          <HeaderActionButton
            icon={
              isFetching.value ? (
                <LoaderIcon class="animate-spin" />
              ) : (
                <RefreshIcon />
              )
            }
            name="刷新"
            onClick={() => refetch()}
          />
        </div>,
      )
    })

    return () => (
      <MasterDetailLayout
        showDetailOnMobile={showDetailOnMobile.value}
        defaultSize={0.35}
        min={0.25}
        max={0.5}
      >
        {{
          list: () => (
            <SearchIndexList
              rows={rows.value}
              loading={isPending.value}
              selectedId={selectedId.value}
              refType={refTypeFilter.value}
              lang={langFilter.value}
              keyword={keywordRaw.value}
              page={pageRef.value}
              pageCount={pageCount.value}
              pageSize={sizeRef.value}
              onSelect={handleSelect}
              onRefTypeChange={(v) => {
                refTypeFilter.value = v
                pageRef.value = 1
              }}
              onLangChange={(v) => {
                langFilter.value = v
                pageRef.value = 1
              }}
              onKeywordInput={(v) => (keywordRaw.value = v)}
              onKeywordCommit={commitKeyword}
              onReset={resetFilters}
              onPageChange={(p) => (pageRef.value = p)}
              onPageSizeChange={(s) => {
                sizeRef.value = s
                pageRef.value = 1
              }}
            />
          ),
          detail: () =>
            selectedRow.value ? (
              <SearchIndexDetailPanel
                row={selectedRow.value}
                isMobile={isMobile.value}
                rebuilding={isSelectedRebuilding.value}
                onBack={handleBack}
                onRebuild={handleRebuildSelected}
              />
            ) : null,
          empty: () => <SearchIndexDetailEmptyState />,
        }}
      </MasterDetailLayout>
    )
  },
})
