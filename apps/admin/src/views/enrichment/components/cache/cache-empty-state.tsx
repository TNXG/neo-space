import { AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { defineComponent } from 'vue'

export const CacheEmptyState = defineComponent({
  name: 'CacheEmptyState',
  props: {
    filtered: { type: Boolean, default: false },
  },
  setup(props) {
    return () => (
      <div class="flex flex-col items-center justify-center py-16">
        <AlertCircleIcon
          class="mb-3 size-10 text-neutral-300 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          {props.filtered ? '无失败项' : '暂无 enrichment 缓存'}
        </p>
      </div>
    )
  },
})
