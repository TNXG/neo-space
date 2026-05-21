import { defineComponent } from 'vue'
import type { PropType } from 'vue'

export type EnrichmentSource = 'cache' | 'screenshots' | 'probe'

const items: Array<{ key: EnrichmentSource; label: string }> = [
  { key: 'cache', label: '缓存' },
  { key: 'screenshots', label: '截图' },
  { key: 'probe', label: '探针' },
]

export const SourceSwitcher = defineComponent({
  name: 'SourceSwitcher',
  props: {
    value: {
      type: String as PropType<EnrichmentSource>,
      required: true,
    },
    onChange: {
      type: Function as PropType<(v: EnrichmentSource) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="inline-flex w-full items-center gap-1 rounded-lg bg-neutral-100/80 p-1 dark:bg-neutral-800/60">
        {items.map((it) => {
          const active = props.value === it.key
          return (
            <button
              key={it.key}
              type="button"
              class={[
                'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                active
                  ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-neutral-700 dark:text-neutral-100 dark:ring-white/10'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
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
