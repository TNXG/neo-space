import { ClipboardCopy as CopyIcon } from 'lucide-vue-next'
import { NButton } from 'naive-ui'
import { computed, defineComponent, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { PropType } from 'vue'

export const RawJsonBlock = defineComponent({
  name: 'RawJsonBlock',
  props: {
    value: {
      type: null as unknown as PropType<unknown>,
      required: true,
    },
    title: { type: String, default: 'Raw payload' },
    defaultExpanded: { type: Boolean, default: false },
  },
  setup(props) {
    const expanded = ref(props.defaultExpanded)

    const text = computed(() =>
      props.value == null ? 'null' : JSON.stringify(props.value, null, 2),
    )

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(text.value)
        toast.success('已复制')
      } catch {
        toast.error('复制失败')
      }
    }

    return () => (
      <section>
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {props.title}
          </h3>
          <div class="flex items-center gap-1">
            <NButton
              size="tiny"
              secondary
              onClick={() => (expanded.value = !expanded.value)}
            >
              {expanded.value ? '收起' : '展开'}
            </NButton>
            <NButton size="tiny" secondary onClick={handleCopy}>
              {{
                icon: () => <CopyIcon class="size-3" />,
                default: () => '复制',
              }}
            </NButton>
          </div>
        </div>
        {expanded.value && (
          <pre class="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {text.value}
          </pre>
        )}
      </section>
    )
  },
})
