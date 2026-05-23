import type { PropType } from "vue";
import { defineComponent } from "vue";

import { RelativeTime } from "~/components/time/relative-time";

export interface DiffStats {
  added: number;
  removed: number;
  /** 与 `calcDiffStats` 一致：`词` 来自 Lexical，`字` 来自纯文本长度差 */
  unit: "词" | "字";
}

export const VersionListItem = defineComponent({
  name: "VersionListItem",
  props: {
    version: {
      type: [Number, String] as PropType<number | "published" | "current">,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    savedAt: {
      type: String,
      required: true,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    diffStats: {
      type: Object as PropType<DiffStats>,
      default: undefined,
    },
    isFullSnapshot: {
      type: Boolean,
      default: undefined,
    },
    onClick: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const getVersionLabel = () => {
      if (props.version === "published") {
        return "已发布版本";
      }
      if (props.version === "current") {
        return "当前草稿";
      }
      return `v${props.version}`;
    };

    return () => (
      <div
        class={[
          "cursor-pointer px-4 py-2.5 transition-colors",
          props.isSelected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        ]}
        onClick={props.onClick}
      >
        <div class="flex gap-3 items-center">
          <div class="flex-1 min-w-0">
            {/* 版本标签行 */}
            <div class="flex flex-wrap gap-2 min-w-0 w-full items-center">
              <span class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
                {getVersionLabel()}
              </span>
              {props.isCurrent && (
                <span class="text-xs text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-200 dark:text-neutral-300 dark:bg-neutral-700">
                  当前
                </span>
              )}
              {props.version === "published" && (
                <span class="text-xs text-green-700 px-1.5 py-0.5 rounded bg-green-100 dark:text-green-400 dark:bg-green-900/50">
                  基准
                </span>
              )}
              {typeof props.version === "number"
                && props.isFullSnapshot !== undefined && (
                <span
                  class={[
                    "rounded px-1.5 py-0.5 text-xs",
                    props.isFullSnapshot
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
                  ]}
                  title={
                    props.isFullSnapshot
                      ? "全量快照，存储完整内容"
                      : "增量存储，仅保存与上一全量版本的差异"
                  }
                >
                  {props.isFullSnapshot ? "全量" : "增量"}
                </span>
              )}
              {props.diffStats
                && (props.diffStats.added > 0 || props.diffStats.removed > 0) && (
                <span class="text-xs ml-auto flex shrink-0 gap-1 items-center">
                  <span class="text-green-600 dark:text-green-400">
                    +
                    {props.diffStats.added}
                  </span>
                  <span class="text-red-600 dark:text-red-400">
                    -
                    {props.diffStats.removed}
                  </span>
                  <span class="text-neutral-500 dark:text-neutral-400">
                    {props.diffStats.unit}
                  </span>
                </span>
              )}
            </div>

            {/* 标题 */}
            <p class="text-xs text-neutral-500 mt-0.5 truncate dark:text-neutral-400">
              {props.title || "无标题"}
            </p>
          </div>

          {/* 右侧：时间 */}
          <div class="flex flex-shrink-0 flex-col gap-0.5 items-end">
            <span class="text-xs text-neutral-400 dark:text-neutral-500">
              <RelativeTime time={props.savedAt} showPopoverInfoAbsoluteTime />
            </span>
          </div>
        </div>
      </div>
    );
  },
});
