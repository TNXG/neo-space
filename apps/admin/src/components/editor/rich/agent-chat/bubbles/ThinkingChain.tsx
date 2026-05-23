import type { PropType } from "vue";
import { ChevronRight, Sparkles } from "lucide-vue-next";
import { defineComponent, ref } from "vue";

export const ThinkingChain = defineComponent({
  name: "ThinkingChain",
  props: {
    id: { type: String, required: true },
    isStreaming: { type: Boolean, required: true },
    rawText: { type: String, required: true },
    steps: { type: Array as PropType<string[]>, required: true },
    defaultExpanded: { type: Boolean, default: false },
  },
  setup(props) {
    const expanded = ref(props.defaultExpanded || props.isStreaming);

    return () => (
      <div>
        <button
          class="text-[13px] text-neutral-400 leading-snug font-inherit py-1 text-left border-none bg-transparent flex gap-2 w-full cursor-pointer transition-colors items-center hover:text-neutral-800 dark:hover:text-neutral-200"
          type="button"
          onClick={() => {
            expanded.value = !expanded.value;
          }}
        >
          <span class="flex flex-shrink-0 h-4 w-4 items-center justify-center">
            <Sparkles
              size={14}
              style={
                props.isStreaming
                  ? "animation: pulse 1.5s ease-in-out infinite"
                  : "opacity: 0.5"
              }
            />
          </span>
          <span
            style={
              props.isStreaming ? { color: "var(--n-text-color)" } : undefined
            }
          >
            Thinking
          </span>

          {props.isStreaming
            ? (
                <span class="flex gap-0.5 items-center">
                  <span class="rounded-full bg-neutral-400 h-1 w-1 animate-pulse" />
                  <span
                    class="rounded-full bg-neutral-400 h-1 w-1 animate-pulse"
                    style="animation-delay: 0.2s"
                  />
                  <span
                    class="rounded-full bg-neutral-400 h-1 w-1 animate-pulse"
                    style="animation-delay: 0.4s"
                  />
                </span>
              )
            : (
                props.steps.length > 0 && (
                  <span class="text-xs text-neutral-400 font-mono opacity-50">
                    {props.steps.length}
                    {" "}
                    steps
                  </span>
                )
              )}

          <span class="flex-1" />
          <ChevronRight
            size={12}
            class={[
              "flex-shrink-0 text-neutral-400 opacity-40 transition-transform",
              expanded.value && "rotate-90",
            ]}
          />
        </button>

        {expanded.value && (
          <div class="text-[13px] text-neutral-400 leading-relaxed pb-2 pl-6 pt-1 flex flex-col gap-1.5">
            {props.steps.map((step, i) => (
              <p key={i} class="m-0">
                {step}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  },
});
