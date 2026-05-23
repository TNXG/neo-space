import type { PropType } from "vue";
import type { DraftModel } from "~/models/draft";
import {
  Book as BookIcon,
  Code as CodeIcon,
  File as FileIcon,
} from "lucide-vue-next";
import { defineComponent } from "vue";

import { RelativeTime } from "~/components/time/relative-time";
import { DraftRefType } from "~/models/draft";

const refTypeConfig = {
  [DraftRefType.Post]: {
    label: "文章",
    icon: CodeIcon,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  [DraftRefType.Note]: {
    label: "手记",
    icon: BookIcon,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/50",
  },
  [DraftRefType.Page]: {
    label: "页面",
    icon: FileIcon,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
  },
};

export const DraftListItem = defineComponent({
  name: "DraftListItem",
  props: {
    data: {
      type: Object as PropType<DraftModel>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const config = refTypeConfig[props.data.refType];

    return () => (
      <div
        class={[
          "cursor-pointer border-b border-neutral-100 px-4 py-2.5 transition-colors last:border-b-0 dark:border-neutral-800",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        ]}
        onClick={props.onSelect}
      >
        <div class="flex gap-3 items-center">
          <div class="flex-1 min-w-0">
            <div class="flex gap-2 items-center">
              <h4 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
                {props.data.title || "无标题"}
              </h4>
              <span class="text-xs text-neutral-400 flex-shrink-0 dark:text-neutral-500">
                v
                {props.data.version}
              </span>
            </div>

            <div class="text-xs mt-1 flex gap-2 items-center">
              <span
                class={[
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                  config.bgColor,
                  config.color,
                ]}
              >
                <config.icon class="h-3 w-3" />
                {config.label}
              </span>

              {props.data.refId
                ? (
                    <span class="text-amber-600 px-1.5 py-0.5 rounded bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50">
                      编辑中
                    </span>
                  )
                : (
                    <span class="text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800">
                      新建
                    </span>
                  )}
            </div>
          </div>

          <div class="text-xs text-neutral-400 flex-shrink-0 dark:text-neutral-500">
            <RelativeTime time={props.data.updatedAt} />
          </div>
        </div>
      </div>
    );
  },
});
