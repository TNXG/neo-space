import type { PropType } from "vue";
import { ClipboardCopy as CopyIcon } from "lucide-vue-next";
import { NButton } from "naive-ui";
import { computed, defineComponent, ref } from "vue";
import { toast } from "vue-sonner";

export const RawJsonBlock = defineComponent({
  name: "RawJsonBlock",
  props: {
    value: {
      type: null as unknown as PropType<unknown>,
      required: true,
    },
    title: { type: String, default: "Raw payload" },
    defaultExpanded: { type: Boolean, default: false },
  },
  setup(props) {
    const expanded = ref(props.defaultExpanded);

    const text = computed(() =>
      props.value == null ? "null" : JSON.stringify(props.value, null, 2),
    );

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(text.value);
        toast.success("已复制");
      } catch {
        toast.error("复制失败");
      }
    };

    return () => (
      <section>
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
            {props.title}
          </h3>
          <div class="flex gap-1 items-center">
            <NButton
              size="tiny"
              secondary
              onClick={() => (expanded.value = !expanded.value)}
            >
              {expanded.value ? "收起" : "展开"}
            </NButton>
            <NButton size="tiny" secondary onClick={handleCopy}>
              {{
                icon: () => <CopyIcon class="size-3" />,
                default: () => "复制",
              }}
            </NButton>
          </div>
        </div>
        {expanded.value && (
          <pre class="text-xs text-neutral-700 leading-relaxed p-3 border border-neutral-200 rounded-md bg-neutral-50 overflow-x-auto dark:text-neutral-300 dark:border-neutral-800 dark:bg-neutral-900">
            {text.value}
          </pre>
        )}
      </section>
    );
  },
});
