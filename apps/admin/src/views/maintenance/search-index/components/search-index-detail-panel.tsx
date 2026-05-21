import {
  ArrowLeft as BackIcon,
  ExternalLink as ExternalLinkIcon,
  Loader2 as LoaderIcon,
  RotateCcw as RetryIcon,
} from 'lucide-vue-next'
import { NButton, NScrollbar, NTag } from 'naive-ui'
import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import type { SearchDocumentAdminRow } from '~/models/search-index'
import type { PropType } from 'vue'

import { RelativeTime } from '~/components/time/relative-time'

import { buildEditUrl, refTypeLabel, refTypeTone } from './constants'

export const SearchIndexDetailPanel = defineComponent({
  name: 'SearchIndexDetailPanel',
  props: {
    row: { type: Object as PropType<SearchDocumentAdminRow>, required: true },
    isMobile: { type: Boolean, default: false },
    rebuilding: { type: Boolean, default: false },
    onBack: { type: Function as PropType<() => void> },
    onRebuild: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    return () => {
      const { row } = props
      const editUrl = buildEditUrl(row.refType, row.refId)
      return (
        <div class="flex h-full flex-col">
          <div class="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            {props.isMobile && (
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onClick={() => props.onBack?.()}
              >
                <BackIcon class="size-4" aria-hidden="true" />
              </button>
            )}
            <NTag size="small" type={refTypeTone[row.refType] ?? 'default'}>
              {refTypeLabel[row.refType] ?? row.refType}
            </NTag>
            <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {row.title || <span class="text-neutral-400">(无标题)</span>}
            </h2>
          </div>

          <NScrollbar class="min-h-0 flex-1">
            <div class="space-y-5 p-4">
              <DetailGrid row={row} />
            </div>
          </NScrollbar>

          <div class="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
            {editUrl && (
              <RouterLink to={editUrl}>
                <NButton size="small" secondary>
                  {{
                    icon: () => (
                      <ExternalLinkIcon class="size-3.5" aria-hidden="true" />
                    ),
                    default: () => '查看原文',
                  }}
                </NButton>
              </RouterLink>
            )}
            <NButton
              size="small"
              type="primary"
              secondary
              loading={props.rebuilding}
              onClick={() => props.onRebuild()}
            >
              {{
                icon: () =>
                  props.rebuilding ? (
                    <LoaderIcon
                      class="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RetryIcon class="size-3.5" aria-hidden="true" />
                  ),
                default: () => '重建',
              }}
            </NButton>
          </div>
        </div>
      )
    }
  },
})

const DetailGrid = defineComponent({
  props: {
    row: { type: Object as PropType<SearchDocumentAdminRow>, required: true },
  },
  setup(props) {
    return () => {
      const { row } = props
      return (
        <div class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="refId">
            <code class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
              {row.refId}
            </code>
          </Field>
          <Field label="主语言">
            {row.lang ? (
              <NTag size="small">{row.lang}</NTag>
            ) : (
              <span class="text-xs text-neutral-400">默认</span>
            )}
          </Field>
          <Field label="sourceHash">
            <code
              class="block truncate rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800"
              title={row.sourceHash}
            >
              {row.sourceHash || '—'}
            </code>
          </Field>
          <Field label="发布状态">
            <div class="flex items-center gap-1">
              {row.isPublished ? (
                <NTag size="small" type="success">
                  已发布
                </NTag>
              ) : (
                <NTag size="small" type="warning">
                  未发布
                </NTag>
              )}
              {row.hasPassword && <NTag size="small">密码保护</NTag>}
            </div>
          </Field>
          <Field label="标题长度">
            <span class="tabular-nums">{row.titleLength}</span>
          </Field>
          <Field label="正文长度">
            <span class="tabular-nums">{row.bodyLength}</span>
          </Field>
          <Field label="最后修改">
            <RelativeTime time={new Date(row.modifiedAt)} />
          </Field>
          <Field label="创建">
            <RelativeTime time={new Date(row.createdAt)} />
          </Field>
        </div>
      )
    }
  },
})

const Field = defineComponent({
  props: { label: { type: String, required: true } },
  setup(props, { slots }) {
    return () => (
      <div class="min-w-0 space-y-1">
        <div class="text-xs text-neutral-500 dark:text-neutral-400">
          {props.label}
        </div>
        <div class="text-neutral-900 dark:text-neutral-100">
          {slots.default?.()}
        </div>
      </div>
    )
  },
})
