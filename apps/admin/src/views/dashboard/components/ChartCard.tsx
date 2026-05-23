import type { PropType, VNode } from "vue";
import { Icon } from "@vicons/utils";
import { NSkeleton } from "naive-ui";

import { defineComponent } from "vue";

export const ChartCard = defineComponent({
  props: {
    title: { type: String, required: true },
    icon: { type: Object as PropType<VNode> },
    loading: { type: Boolean, default: false },
    height: { type: Number, default: 250 },
  },
  setup(props, { slots }) {
    return () => (
      <div class="border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div class="px-4 py-3 flex items-center justify-between">
          <h4 class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
            {props.title}
          </h4>
          {props.icon && (
            <Icon class="text-sm text-neutral-400">{props.icon}</Icon>
          )}
        </div>
        {props.loading
          ? (
              <div class="px-4 pb-3">
                <NSkeleton height={`${props.height}px`} />
              </div>
            )
          : (
              <div style={{ height: `${props.height}px` }}>{slots.default?.()}</div>
            )}
      </div>
    );
  },
});
