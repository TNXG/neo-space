import { Image as ImageIcon } from "lucide-vue-next";
import { defineComponent } from "vue";
import { useRouter } from "vue-router";

import { RouteName } from "~/router/name";

export const ScreenshotEmptyState = defineComponent({
  name: "ScreenshotEmptyState",
  setup() {
    const router = useRouter();
    const goSettings = () =>
      router.push({
        name: RouteName.Setting,
        query: { group: "integrations" },
      });
    return () => (
      <div class="px-6 py-16 text-center flex flex-col items-center justify-center">
        <ImageIcon
          class="text-neutral-300 mb-3 size-10 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="text-sm text-neutral-500 mb-1 dark:text-neutral-400">
          暂无截图缓存
        </p>
        <p class="text-xs text-neutral-400">
          请在
          <button
            type="button"
            class="text-neutral-600 mx-1 underline-offset-2 dark:text-neutral-300 hover:underline"
            onClick={goSettings}
          >
            集成设置
          </button>
          中启用 openGraph.screenshot
        </p>
      </div>
    );
  },
});
