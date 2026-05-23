import { Search as SearchIcon } from "lucide-vue-next";
import { defineComponent } from "vue";

export const SearchIndexEmptyState = defineComponent({
  name: "SearchIndexEmptyState",
  setup() {
    return () => (
      <div class="py-16 flex flex-col h-full items-center justify-center">
        <SearchIcon
          class="text-neutral-300 mb-3 size-10 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          暂无匹配的索引行
        </p>
      </div>
    );
  },
});

export const SearchIndexDetailEmptyState = defineComponent({
  name: "SearchIndexDetailEmptyState",
  setup() {
    return () => (
      <div class="py-16 flex flex-col h-full items-center justify-center">
        <SearchIcon
          class="text-neutral-300 mb-3 size-10 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          请从左侧选择一条索引行
        </p>
      </div>
    );
  },
});
