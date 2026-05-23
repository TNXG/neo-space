import type { ToolCallGroupItem } from "@haklex/rich-agent-core";
import type { PropType } from "vue";
import type { ReplayStateMap } from "../composables/use-agent-reapply";
import {
  Check,
  ChevronRight,
  Copy,
  Loader2,
  RotateCw,
  X,
} from "lucide-vue-next";
import { defineComponent, ref } from "vue";
import { toast } from "vue-sonner";

import { itemReplayKey } from "../composables/use-agent-reapply";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("已复制");
  } catch {
    toast.error("复制失败");
  }
}

function serializeItem(item: ToolCallGroupItem): string {
  return JSON.stringify(
    {
      id: item.id,
      toolName: item.toolName,
      description: item.description,
      status: item.status,
      params: item.params,
      result: item.result,
      error: item.error,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
    },
    null,
    2,
  );
}

function StatusIcon({ status }: { status: ToolCallGroupItem["status"] }) {
  return (
    <span class="flex flex-shrink-0 h-4 w-4 items-center justify-center">
      {status === "pending" && (
        <span class="rounded-full bg-neutral-300 opacity-40 h-1.5 w-1.5" />
      )}
      {status === "running" && <Loader2 size={14} class="animate-spin" />}
      {status === "completed" && <Check size={14} />}
      {status === "error" && <X size={14} class="text-red-600" />}
    </span>
  );
}

function Section({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone?: "error";
}) {
  const isError = tone === "error";
  return (
    <div class="group/section max-w-full min-w-0 relative">
      <div class="mb-0.5 flex gap-2 min-w-0 items-center justify-between">
        <span class="text-[10px] text-neutral-400 tracking-wide font-mono uppercase">
          {label}
        </span>
        <span
          role="button"
          tabindex={0}
          title={`复制 ${label}`}
          class="text-[10px] text-neutral-400 px-1 rounded opacity-0 flex gap-1 h-5 cursor-pointer transition-opacity items-center hover:text-neutral-700 hover:bg-neutral-100 group-hover/section:opacity-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            copyText(text);
          }}
        >
          <Copy size={10} />
          Copy
        </span>
      </div>
      <pre
        class={[
          "m-0 max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-all rounded p-1.5 font-mono text-[11px]",
          isError
            ? "bg-red-50 text-red-600 dark:bg-red-950/20"
            : "bg-neutral-50 text-neutral-500 dark:bg-neutral-900",
        ]}
      >
        {text}
      </pre>
    </div>
  );
}

function formatDuration(item: ToolCallGroupItem): string | null {
  if (!item.startedAt || !item.finishedAt)
    return null;
  return `${item.finishedAt - item.startedAt}ms`;
}

export const ToolCall = defineComponent({
  name: "ToolCall",
  props: {
    item: { type: Object as PropType<ToolCallGroupItem>, required: true },
    defaultExpanded: { type: Boolean, default: false },
    replayState: {
      type: Object as PropType<ReplayStateMap>,
      default: () => ({}),
    },
    isReplayable: { type: Boolean, default: false },
  },
  emits: ["reapply"],
  setup(props, { emit }) {
    const expanded = ref(props.defaultExpanded);

    return () => {
      const item = props.item;
      const hasContent
        = Object.keys(item.params).length > 0 || item.result || item.error;
      const duration = formatDuration(item);
      const rKey = itemReplayKey(item.id);
      const rState = props.replayState?.[rKey];
      const isReplayRunning = rState?.status === "running";

      return (
        <div class="group/toolcall max-w-full min-w-0">
          <button
            class={[
              "font-inherit flex w-full min-w-0 max-w-full items-center gap-2 border-none bg-transparent py-1 text-left text-[13px] leading-snug text-neutral-400 transition-colors",
              hasContent
                ? "cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200"
                : "cursor-default",
            ]}
            type="button"
            onClick={() => hasContent && (expanded.value = !expanded.value)}
          >
            <StatusIcon status={item.status} />
            <span class="flex flex-1 gap-2 min-w-0 items-center overflow-hidden">
              <span
                class="text-[13px] font-mono truncate"
                style={
                  item.status === "running"
                    ? { color: "var(--n-text-color)" }
                    : undefined
                }
              >
                {item.toolName}
              </span>
              {item.description && (
                <span class="text-[13px] text-neutral-300 flex-1 min-w-0 truncate">
                  {item.description}
                </span>
              )}
            </span>
            {duration && (
              <span class="text-xs text-neutral-300 font-mono opacity-50 flex-shrink-0">
                {duration}
              </span>
            )}
            <span
              role="button"
              tabindex={0}
              title="复制此 tool call JSON"
              class="rounded opacity-0 flex flex-shrink-0 h-5 w-5 cursor-pointer transition-opacity items-center justify-center hover:bg-neutral-100 group-hover/toolcall:opacity-60 hover:opacity-100 dark:hover:bg-neutral-800"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                copyText(serializeItem(item));
              }}
            >
              <Copy size={12} />
            </span>
            {props.isReplayable && (
              <>
                {rState?.status === "success" && (
                  <span class="text-xs text-green-600 flex-shrink-0">
                    Re-applied
                  </span>
                )}
                {rState?.status === "conflict" && (
                  <span
                    class="text-xs text-amber-600 flex-shrink-0"
                    title={rState.message}
                  >
                    Conflict
                  </span>
                )}
                {rState?.status === "error" && (
                  <span
                    class="text-xs text-red-600 flex-shrink-0"
                    title={rState.message}
                  >
                    Failed
                  </span>
                )}
                {(!rState || rState.status === "idle") && (
                  <span
                    role="button"
                    tabindex={0}
                    title="Re-apply this tool call"
                    class="text-xs text-neutral-400 px-1 rounded opacity-0 flex flex-shrink-0 gap-1 h-5 cursor-pointer transition-opacity items-center hover:text-neutral-700 hover:bg-neutral-100 group-hover/toolcall:opacity-60 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 hover:!opacity-100"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation();
                      emit("reapply");
                    }}
                  >
                    <RotateCw size={11} />
                    Re-apply
                  </span>
                )}
                {isReplayRunning && (
                  <span class="text-xs text-neutral-400 flex flex-shrink-0 gap-1 items-center">
                    <Loader2 size={11} class="animate-spin" />
                  </span>
                )}
              </>
            )}
            {hasContent && (
              <ChevronRight
                size={12}
                class={[
                  "flex-shrink-0 text-neutral-400 opacity-40 transition-transform",
                  expanded.value && "rotate-90",
                ]}
              />
            )}
          </button>

          {hasContent && expanded.value && (
            <div class="pb-2 pl-6 flex flex-col gap-2 max-w-full min-w-0">
              {Object.keys(item.params).length > 0 && (
                <Section
                  label="params"
                  text={JSON.stringify(item.params, null, 2)}
                />
              )}
              {item.result && <Section label="result" text={item.result} />}
              {item.error && (
                <Section label="error" text={item.error} tone="error" />
              )}
              {rState
                && (rState.status === "conflict" || rState.status === "error")
                && rState.message && (
                <Section
                  label="replay"
                  text={rState.message}
                  tone={rState.status === "error" ? "error" : undefined}
                />
              )}
            </div>
          )}
        </div>
      );
    };
  },
});
