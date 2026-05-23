import type { PropType } from "vue";
import type { ProbeHistoryEntry } from "./types";
import {
  AlertCircle as AlertIcon,
  CheckCircle2 as CheckIcon,
  Search as SearchIcon,
} from "lucide-vue-next";
import { NScrollbar } from "naive-ui";
import { defineComponent } from "vue";

import { RelativeTime } from "~/components/time/relative-time";

export const ProbeList = defineComponent({
  name: "ProbeList",
  props: {
    history: {
      type: Array as PropType<ProbeHistoryEntry[]>,
      required: true,
    },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    onSelect: {
      type: Function as PropType<(entry: ProbeHistoryEntry) => void>,
      required: true,
    },
    onNew: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="flex flex-col h-full min-h-0">
        <div class="px-4 py-2 border-b border-neutral-200 flex shrink-0 items-center justify-between dark:border-neutral-800">
          <span class="text-xs text-neutral-500 dark:text-neutral-400">
            最近试抓
            {" "}
            {props.history.length}
            /20
          </span>
          <button
            type="button"
            class="text-xs text-neutral-600 px-2 py-1 rounded inline-flex gap-1 items-center dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={props.onNew}
          >
            <SearchIcon class="size-3" />
            新试抓
          </button>
        </div>

        <div class="flex-1 min-h-0">
          {props.history.length === 0
            ? (
                <div class="px-6 py-16 text-center flex flex-col items-center justify-center">
                  <SearchIcon class="text-neutral-300 mb-3 size-10 dark:text-neutral-600" />
                  <p class="text-sm text-neutral-500">暂无试抓记录</p>
                  <p class="text-xs text-neutral-400 mt-1">右侧输入 URL 即可开始</p>
                </div>
              )
            : (
                <NScrollbar class="h-full">
                  <div>
                    {props.history.map(entry => (
                      <ProbeHistoryItem
                        key={entry.id}
                        entry={entry}
                        selected={props.selectedId === entry.id}
                        onSelect={() => props.onSelect(entry)}
                      />
                    ))}
                  </div>
                </NScrollbar>
              )}
        </div>
      </div>
    );
  },
});

const ProbeHistoryItem = defineComponent({
  name: "ProbeHistoryItem",
  props: {
    entry: {
      type: Object as PropType<ProbeHistoryEntry>,
      required: true,
    },
    selected: { type: Boolean, default: false },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const { entry } = props;
      const ok = !entry.result.error && !!entry.result.matched;
      return (
        <div
          class={[
            "flex cursor-pointer flex-col gap-1 border-b border-neutral-100 px-4 py-2.5 transition-colors last:border-b-0 dark:border-neutral-800/50",
            props.selected
              ? "bg-neutral-100 dark:bg-neutral-800"
              : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
          ]}
          onClick={props.onSelect}
        >
          <div class="text-xs flex gap-1.5 items-center">
            {ok
              ? (
                  <span class="text-[11px] text-green-700 px-1.5 py-0.5 rounded bg-green-50 inline-flex gap-1 items-center dark:text-green-400 dark:bg-green-950/30">
                    <CheckIcon class="size-3" />
                    成功
                  </span>
                )
              : (
                  <span class="text-[11px] text-amber-700 px-1.5 py-0.5 rounded bg-amber-50 inline-flex gap-1 items-center dark:text-amber-400 dark:bg-amber-950/30">
                    <AlertIcon class="size-3" />
                    {entry.result.error ? "失败" : "未匹配"}
                  </span>
                )}
            <span class="text-[10px] text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800">
              {entry.result.cached ? "cached" : "fresh"}
            </span>
          </div>
          <code class="text-[11px] text-neutral-700 font-mono truncate dark:text-neutral-300">
            {entry.url}
          </code>
          <span class="text-[11px] text-neutral-400">
            <RelativeTime time={entry.at} />
          </span>
        </div>
      );
    };
  },
});
