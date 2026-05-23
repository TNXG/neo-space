import { defineComponent } from "vue";

export const ErrorBubble = defineComponent({
  name: "ErrorBubble",
  props: {
    message: { type: String, required: true },
  },
  emits: ["retry"],
  setup(props, { emit }) {
    return () => (
      <div class="text-[13px] text-red-600 leading-relaxed my-2 flex gap-2 items-baseline">
        <span>{props.message}</span>
        <button
          class="text-xs text-red-600 font-inherit p-0 border-none bg-transparent underline cursor-pointer hover:opacity-80"
          type="button"
          onClick={() => emit("retry")}
        >
          Retry
        </button>
      </div>
    );
  },
});
