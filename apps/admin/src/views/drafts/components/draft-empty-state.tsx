import { GitCompare } from "lucide-vue-next";
import { defineComponent } from "vue";

export const DraftEmptyState = defineComponent({
  name: "DraftEmptyState",
  setup() {
    return () => (
      <div class="text-center flex flex-col gap-4 h-full items-center justify-center">
        <div class="rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <GitCompare class="text-neutral-400 size-8 dark:text-neutral-500" />
        </div>
        <div>
          <p class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
            选择一个草稿查看版本历史
          </p>
          <p class="text-xs text-neutral-500 mt-1 dark:text-neutral-400">
            点击左侧草稿，在这里对比不同版本的差异
          </p>
        </div>
      </div>
    );
  },
});
