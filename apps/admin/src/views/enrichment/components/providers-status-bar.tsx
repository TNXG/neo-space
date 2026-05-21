import {
  CheckCircle2 as CheckIcon,
  AlertTriangle as MissingIcon,
  CircleSlash as OffIcon,
} from 'lucide-vue-next'
import { NTooltip } from 'naive-ui'
import { computed, defineComponent } from 'vue'
import { useRouter } from 'vue-router'
import type { EnrichmentProviderMeta } from '~/models/enrichment'
import type { PropType } from 'vue'

import { useQuery } from '@tanstack/vue-query'

import { enrichmentApi } from '~/api/enrichment'
import { queryKeys } from '~/hooks/queries/keys'
import { RouteName } from '~/router/name'

type ProviderState = 'ok' | 'missing' | 'disabled'

const SELF_GROUP_KEY = '__self__'

const configKeyLabel: Record<string, string> = {
  github: 'GitHub',
  tmdb: 'TMDB',
  bangumi: 'Bangumi',
  neodb: 'NeoDB',
  arxiv: 'Arxiv',
  leetcode: 'LeetCode',
  neteaseMusic: '网易云',
  qqMusic: 'QQ 音乐',
}

export const ProvidersStatusBar = defineComponent({
  name: 'ProvidersStatusBar',
  setup() {
    const router = useRouter()

    const { data: providers } = useQuery({
      queryKey: queryKeys.enrichment.providers(),
      queryFn: () => enrichmentApi.providers(),
      staleTime: 60_000,
    })

    const groups = computed(() => {
      const list = providers.value || []
      const byGate = new Map<
        string,
        {
          configKey: string
          label: string
          state: ProviderState
          providers: EnrichmentProviderMeta[]
          missingKeys: string[]
        }
      >()

      for (const p of list) {
        const configKey = p.featureGateConfigKey ?? SELF_GROUP_KEY
        const existing = byGate.get(configKey)
        if (existing) {
          existing.providers.push(p)
          if (existing.state === 'ok') {
            if (!p.enabled) existing.state = 'disabled'
            else if (!p.ready) existing.state = 'missing'
          } else if (existing.state === 'missing' && !p.enabled) {
            existing.state = 'disabled'
          }
          for (const k of p.missingKeys ?? [])
            if (!existing.missingKeys.includes(k)) existing.missingKeys.push(k)
          continue
        }
        const state: ProviderState =
          configKey === SELF_GROUP_KEY
            ? 'ok'
            : !p.enabled
              ? 'disabled'
              : !p.ready
                ? 'missing'
                : 'ok'
        byGate.set(configKey, {
          configKey,
          label:
            configKey === SELF_GROUP_KEY
              ? '本站'
              : (configKeyLabel[configKey] ?? configKey),
          state,
          providers: [p],
          missingKeys: [...(p.missingKeys ?? [])],
        })
      }

      return Array.from(byGate.values())
    })

    const handleClick = (configKey: string) => {
      if (configKey === SELF_GROUP_KEY) return
      router.push({
        name: RouteName.Setting,
        query: { group: 'integrations' },
      })
    }

    return () => {
      if (!providers.value || providers.value.length === 0) return null
      return (
        <div class="flex flex-wrap gap-1.5">
          {groups.value.map((g) => (
            <ProviderChip
              key={g.configKey}
              label={g.label}
              state={g.state}
              providers={g.providers}
              missingHint={
                g.state === 'missing'
                  ? `缺 ${g.missingKeys.length > 0 ? g.missingKeys.join(', ') : '凭证'}`
                  : undefined
              }
              onClick={() => handleClick(g.configKey)}
              clickable={g.configKey !== SELF_GROUP_KEY}
            />
          ))}
        </div>
      )
    }
  },
})

const ProviderChip = defineComponent({
  name: 'ProviderChip',
  props: {
    label: { type: String, required: true },
    state: { type: String as PropType<ProviderState>, required: true },
    providers: {
      type: Array as PropType<EnrichmentProviderMeta[]>,
      required: true,
    },
    missingHint: String,
    clickable: { type: Boolean, default: true },
    onClick: Function as PropType<() => void>,
  },
  setup(props) {
    const stateConfig = computed(() => {
      switch (props.state) {
        case 'ok':
          return {
            cls: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400',
            Icon: CheckIcon,
          }
        case 'missing':
          return {
            cls: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-400',
            Icon: MissingIcon,
          }
        case 'disabled':
          return {
            cls: 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500',
            Icon: OffIcon,
          }
      }
    })
    return () => {
      const sc = stateConfig.value
      const tooltipLines = [
        ...props.providers.map((p) => {
          const localeNote =
            p.localeAware && p.supportedLocales?.length
              ? ` (i18n: ${p.supportedLocales.join('/')})`
              : ''
          return `· ${p.displayName}${localeNote}`
        }),
        ...(props.missingHint ? ['', props.missingHint] : []),
      ]
      const hasI18n = props.providers.some((p) => p.localeAware === true)
      const chip = (
        <button
          type="button"
          class={[
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-opacity',
            sc.cls,
            props.clickable
              ? 'cursor-pointer hover:opacity-80'
              : 'cursor-default',
          ]}
          onClick={() => props.clickable && props.onClick?.()}
        >
          <sc.Icon class="size-3" aria-hidden="true" />
          <span class="font-medium">{props.label}</span>
          {hasI18n && (
            <span
              class="text-[10px] text-neutral-500 dark:text-neutral-400"
              title="支持多语言"
            >
              i18n
            </span>
          )}
          {props.missingHint && (
            <span class="text-yellow-600 dark:text-yellow-500">⚠</span>
          )}
        </button>
      )
      return (
        <NTooltip trigger="hover" placement="top">
          {{
            trigger: () => chip,
            default: () => (
              <div class="text-xs">
                {tooltipLines.map((l, i) => (
                  <div key={i}>{l || ' '}</div>
                ))}
              </div>
            ),
          }}
        </NTooltip>
      )
    }
  },
})
