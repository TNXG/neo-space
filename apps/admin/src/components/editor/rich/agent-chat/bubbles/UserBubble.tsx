import { defineComponent } from "vue";

export const UserBubble = defineComponent({
  name: "UserBubble",
  props: {
    content: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <div class="text-sm text-white leading-relaxed px-3.5 py-2.5 rounded-[18px_18px_6px_18px] bg-neutral-800 max-w-[82%] self-end dark:text-neutral-900 dark:bg-neutral-200">
        {props.content}
      </div>
    );
  },
});
