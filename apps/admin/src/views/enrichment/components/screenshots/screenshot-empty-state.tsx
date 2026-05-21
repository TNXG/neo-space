import { Image as ImageIcon } from 'lucide-vue-next'
import { defineComponent } from 'vue'
import { useRouter } from 'vue-router'

import { RouteName } from '~/router/name'

export const ScreenshotEmptyState = defineComponent({
  name: 'ScreenshotEmptyState',
  setup() {
    const router = useRouter()
    const goSettings = () =>
      router.push({
        name: RouteName.Setting,
        query: { group: 'integrations' },
      })
    return () => (
      <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
        <ImageIcon
          class="mb-3 size-10 text-neutral-300 dark:text-neutral-600"
          aria-hidden="true"
        />
        <p class="mb-1 text-sm text-neutral-500 dark:text-neutral-400">
          暂无截图缓存
        </p>
        <p class="text-xs text-neutral-400">
          请在
          <button
            type="button"
            class="mx-1 text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-300"
            onClick={goSettings}
          >
            集成设置
          </button>
          中启用 openGraph.screenshot
        </p>
      </div>
    )
  },
})
