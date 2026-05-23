import { MessageCircle as MessageCircleIcon } from "lucide-vue-next";
import { defineComponent } from "vue";

export const CommentEmptyState = defineComponent({
  name: "CommentEmptyState",
  setup() {
    return () => (
      <div class="text-center flex flex-col h-full items-center justify-center">
        <MessageCircleIcon class="text-neutral-300 mb-4 h-12 w-12 dark:text-neutral-700" />
        <p class="text-neutral-500">选择一条评论查看详情</p>
      </div>
    );
  },
});
