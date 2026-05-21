import { Search as SearchIcon } from 'lucide-vue-next'
import { defineComponent } from 'vue'

export const SearchIndexEmptyState = defineComponent({
  name: 'SearchIndexEmptyState',
  setup() {
    return () => (
      <div class="flex h-full flex-col items-center justify-center py-16">
        <SearchIcon
          class="mb-3 size-10 text-neutral-300 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          暂无匹配的索引行
        </p>
      </div>
    )
  },
})

export const SearchIndexDetailEmptyState = defineComponent({
  name: 'SearchIndexDetailEmptyState',
  setup() {
    return () => (
      <div class="flex h-full flex-col items-center justify-center py-16">
        <SearchIcon
          class="mb-3 size-10 text-neutral-300 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          请从左侧选择一条索引行
        </p>
      </div>
    )
  },
})
