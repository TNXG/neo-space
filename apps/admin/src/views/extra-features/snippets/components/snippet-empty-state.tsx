import type { PropType } from "vue";
import { Code2, MousePointerClick, Plus } from "lucide-vue-next";
import { NButton } from "naive-ui";
import { defineComponent } from "vue";

export const SnippetEmptyState = defineComponent({
  name: "SnippetEmptyState",
  props: {
    hasSnippets: {
      type: Boolean,
      default: false,
    },
    onCreate: {
      type: Function as PropType<() => void>,
    },
  },
  setup(props) {
    return () => (
      <div class="text-center bg-neutral-50 flex flex-col h-full items-center justify-center dark:bg-neutral-950">
        {props.hasSnippets
          ? (
              <>
                <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
                  <MousePointerClick class="text-neutral-400 size-8" />
                </div>
                <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">
                  选择一个片段
                </h3>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                  从左侧列表选择一个片段进行编辑
                </p>
              </>
            )
          : (
              <>
                <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
                  <Code2 class="text-neutral-400 size-8" />
                </div>
                <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">
                  暂无配置片段
                </h3>
                <p class="text-sm text-neutral-500 mb-4 dark:text-neutral-400">
                  创建你的第一个配置片段
                </p>
                <NButton
                  type="primary"
                  onClick={props.onCreate}
                  renderIcon={() => <Plus class="size-4" />}
                >
                  新建片段
                </NButton>
              </>
            )}
      </div>
    );
  },
});
